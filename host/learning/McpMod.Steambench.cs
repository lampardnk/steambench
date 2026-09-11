using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using HarmonyLib;
using MegaCrit.Sts2.Core.Combat;
using MegaCrit.Sts2.Core.Context;
using MegaCrit.Sts2.Core.Entities.Potions;
using MegaCrit.Sts2.Core.Models;
using MegaCrit.Sts2.Core.Nodes.Cards.Holders;
using MegaCrit.Sts2.Core.Nodes.Combat;
using MegaCrit.Sts2.Core.Nodes.Screens;
using MegaCrit.Sts2.Core.Nodes.Screens.CardSelection;
using MegaCrit.Sts2.Core.Nodes.Screens.CharacterSelect;
using MegaCrit.Sts2.Core.Nodes.Screens.Overlays;
using MegaCrit.Sts2.Core.Runs;

namespace STS2_MCP;

// Steambench adds only structured identities and build metadata needed to make
// semantic actions stale-safe. It deliberately exposes no navigation graph,
// hotkeys, bindings, or input-device state.
public static partial class McpMod
{
    private sealed class ObservedCardIdentity
    {
        public int Value { get; } = ++_nextObservedCard;
    }

    private static int _nextObservedCard;
    private static readonly ConditionalWeakTable<CardModel, ObservedCardIdentity> ObservedCards = new();
    private static int CardIdentity(CardModel card) => ObservedCards.GetValue(card, _ => new ObservedCardIdentity()).Value;

    private static void AddSelectionCardIdentities(Dictionary<string, object?> result)
    {
        var overlay = NOverlayStack.Instance?.Peek();
        if (!result.TryGetValue("card_select", out var selectObject)
            || selectObject is not Dictionary<string, object?> select
            || !select.TryGetValue("cards", out var cardsObject)
            || cardsObject is not List<Dictionary<string, object?>> cards) return;
        List<NGridCardHolder>? holders = overlay switch
        {
            NCardGridSelectionScreen grid => FindAllSortedByPosition<NGridCardHolder>(grid),
            NChooseACardSelectionScreen choose => FindAllSortedByPosition<NGridCardHolder>(choose),
            _ => null
        };
        if (holders == null) return;
        int index = 0;
        foreach (var holder in holders)
        {
            if (holder.CardModel is not CardModel card) continue;
            if (index >= cards.Count) break;
            cards[index++]["instance_id"] = CardIdentity(card);
        }
    }

    private static void AddHandSelectionCardIdentities(Dictionary<string, object?> result)
    {
        var hand = NPlayerHand.Instance;
        if (hand == null
            || !result.TryGetValue("hand_select", out var selectObject)
            || selectObject is not Dictionary<string, object?> select) return;
        if (select.TryGetValue("cards", out var cardsObject)
            && cardsObject is List<Dictionary<string, object?>> cards)
        {
            int index = 0;
            foreach (var holder in hand.ActiveHolders)
            {
                if (holder.CardModel is not CardModel card) continue;
                if (index >= cards.Count) break;
                cards[index++]["instance_id"] = CardIdentity(card);
            }
        }
        if (select.TryGetValue("selected_cards", out var selectedObject)
            && selectedObject is List<Dictionary<string, object?>> selected)
        {
            var container = hand.GetNodeOrNull<Godot.Control>("%SelectedHandCardContainer");
            if (container == null) return;
            int index = 0;
            foreach (var holder in FindAll<NSelectedHandCardHolder>(container))
            {
                if (holder.CardModel is not CardModel card) continue;
                if (index >= selected.Count) break;
                selected[index++]["instance_id"] = CardIdentity(card);
            }
        }
    }

    [HarmonyPatch(typeof(McpMod), "BuildGameState")]
    private static class SteambenchObservationPatch
    {
        private static void Postfix(Dictionary<string, object?> __result)
        {
            try
            {
                __result["sensor_version"] = 7;
                __result["build"] = new Dictionary<string, object?> {
                    ["game"] = typeof(CardModel).Module.ModuleVersionId.ToString(),
                    ["mod"] = typeof(McpMod).Module.ModuleVersionId.ToString()
                };
                var run = RunManager.Instance.DebugOnlyGetState();
                var player = run == null ? null : LocalContext.GetMe(run);
                if (player != null)
                {
                    var deck = new List<Dictionary<string, object?>>();
                    foreach (var card in player.Deck.Cards) deck.Add(BuildCardInfo(card));
                    __result["deck"] = deck;
                }
                if (__result.TryGetValue("game_over", out var gameOverObject)
                    && gameOverObject is Dictionary<string, object?> gameOver && run != null)
                {
                    var won = RunManager.Instance.History?.Win ?? run.CurrentRoom?.IsVictoryRoom;
                    if (won.HasValue) gameOver["win"] = won.Value;
                }
                var combat = CombatManager.Instance.DebugOnlyGetState();
                __result["encounter_id"] = CombatManager.Instance.IsInProgress && combat != null
                    ? RuntimeHelpers.GetHashCode(combat).ToString() : null;
                if (string.Equals(__result.GetValueOrDefault("menu_screen") as string, "character_select", StringComparison.Ordinal))
                {
                    var tree = Godot.Engine.GetMainLoop() as Godot.SceneTree;
                    var selected = tree?.Root == null ? null : FindAll<NCharacterSelectButton>(tree.Root)
                        .FirstOrDefault(button => button.IsSelected);
                    if (selected?.Character != null)
                        __result["selected_character"] = selected.Character.Id.Entry;
                }
                if (player != null
                    && __result.TryGetValue("player", out var playerObject)
                    && playerObject is Dictionary<string, object?> playerState)
                {
                    if (playerState.TryGetValue("potions", out var potionsObject)
                        && potionsObject is List<Dictionary<string, object?>> potionStates)
                    {
                        int potionIndex = 0;
                        foreach (var potion in player.PotionSlots)
                        {
                            if (potion == null) continue;
                            if (potionIndex >= potionStates.Count) break;
                            bool inCombat = CombatManager.Instance.IsInProgress;
                            potionStates[potionIndex]["usage"] = potion.Usage.ToString();
                            potionStates[potionIndex]["can_use"] = !potion.IsQueued
                                && !potion.Owner.Creature.IsDead
                                && potion.PassesCustomUsabilityCheck
                                && potion.Usage != PotionUsage.Automatic
                                && (potion.Usage != PotionUsage.CombatOnly || (inCombat && IsPlayPhase(player)))
                                && (!inCombat || !CombatManager.Instance.PlayerActionsDisabled);
                            potionIndex++;
                        }
                    }
                    if (player.PlayerCombatState is { } piles)
                    {
                        foreach (var pair in new[] { ("draw_pile", piles.DrawPile.Cards), ("discard_pile", piles.DiscardPile.Cards), ("exhaust_pile", piles.ExhaustPile.Cards) })
                        {
                            var list = new List<Dictionary<string, object?>>();
                            foreach (var item in pair.Item2)
                            {
                                var info = BuildCardInfo(item);
                                info["instance_id"] = CardIdentity(item);
                                list.Add(info);
                            }
                            if (pair.Item1 == "draw_pile") list = list.OrderBy(item => (int)item["instance_id"]!).ToList();
                            playerState[pair.Item1] = list;
                        }
                        var handCards = piles.Hand.Cards;
                        if (playerState.TryGetValue("hand", out var handObject) && handObject is List<Dictionary<string, object?>> hand)
                        {
                            for (int index = 0; index < hand.Count && index < handCards.Count; index++)
                                hand[index]["instance_id"] = CardIdentity(handCards[index]);
                        }
                    }
                }
                AddSelectionCardIdentities(__result);
                AddHandSelectionCardIdentities(__result);
            }
            catch (Exception error)
            {
                __result["sensor_error"] = error.GetType().Name;
            }
        }
    }
}
