using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;
using Godot;
using HarmonyLib;
using MegaCrit.Sts2.Core.Combat;
using MegaCrit.Sts2.Core.Context;
using MegaCrit.Sts2.Core.Models;
using MegaCrit.Sts2.Core.Nodes;
using MegaCrit.Sts2.Core.Nodes.Combat;
using MegaCrit.Sts2.Core.Nodes.Rooms;
using MegaCrit.Sts2.Core.Runs;

namespace STS2_MCP;

public static partial class McpMod
{
    private sealed class ObservedCardIdentity
    {
        public int Value { get; } = ++_nextObservedCard;
    }

    private static int _nextObservedCard;
    private static readonly ConditionalWeakTable<CardModel, ObservedCardIdentity> ObservedCards = new();
    private static int CardIdentity(CardModel card) => ObservedCards.GetValue(card, _ => new ObservedCardIdentity()).Value;

    [HarmonyPatch(typeof(McpMod), "BuildGameState")]
    private static class SteambenchObservationPatch
    {
        private static void Postfix(Dictionary<string, object?> __result)
        {
            var observation = new Dictionary<string, object?> { ["sensor_version"] = 2 };
            __result["ui"] = observation;
            try
            {
                var tree = Engine.GetMainLoop() as SceneTree;
                var focus = tree?.Root?.GuiGetFocusOwner();
                observation["focus_path"] = focus?.GetPath().ToString();
                observation["focus_type"] = focus?.GetType().Name;
                observation["hand_mode"] = NPlayerHand.Instance?.CurrentMode.ToString();
                observation["in_card_play"] = NPlayerHand.Instance?.InCardPlay ?? false;
                observation["selected_card"] = null;
                var handNode = NPlayerHand.Instance;
                if (handNode?.InCardPlay == true)
                {
                    var selected = AccessTools.Field(typeof(NPlayerHand), "_currentCardPlay")?.GetValue(handNode) as NCardPlay;
                    if (selected?.Holder?.CardModel is CardModel selectedCard)
                        observation["selected_card"] = CardIdentity(selectedCard);
                }
                observation["game_build"] = typeof(CardModel).Module.ModuleVersionId.ToString();
                observation["mod_build"] = typeof(McpMod).Module.ModuleVersionId.ToString();
                observation["targeting"] = NRun.Instance != null && NTargetManager.Instance.IsInSelection;
                observation["focused_card"] = null;
                observation["focused_creature"] = null;
                for (Node? node = focus; node != null; node = node.GetParent())
                {
                    if (node is NCreature creatureNode)
                    {
                        observation["focused_creature"] = creatureNode.Entity.CombatId;
                        break;
                    }
                    if (node.GetType().GetProperty("CardModel")?.GetValue(node) is CardModel card)
                    {
                        observation["focused_card"] = CardIdentity(card);
                        break;
                    }
                }
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
                var targets = new List<Dictionary<string, object?>>();
                var combat = CombatManager.Instance.DebugOnlyGetState();
                if (CombatManager.Instance.IsInProgress && combat != null && NCombatRoom.Instance != null)
                {
                    foreach (var enemy in combat.Enemies)
                    {
                        var node = NCombatRoom.Instance.GetCreatureNode(enemy);
                        if (!enemy.IsAlive || node == null) continue;
                        targets.Add(new Dictionary<string, object?> {
                            ["combat_id"] = enemy.CombatId, ["hittable"] = enemy.IsHittable,
                            ["x"] = Math.Round(node.GlobalPosition.X), ["y"] = Math.Round(node.GlobalPosition.Y)
                        });
                    }
                }
                observation["targets"] = targets;
                var cards = player?.PlayerCombatState?.Hand.Cards;
                if (cards != null && __result.TryGetValue("player", out var playerObject)
                    && playerObject is Dictionary<string, object?> playerState
                    && playerState.TryGetValue("hand", out var handObject)
                    && handObject is List<Dictionary<string, object?>> hand)
                {
                    for (int index = 0; index < hand.Count && index < cards.Count; index++)
                        hand[index]["instance_id"] = CardIdentity(cards[index]);
                }
            }
            catch (Exception error)
            {
                observation["error"] = error.GetType().Name;
            }
        }
    }
}
