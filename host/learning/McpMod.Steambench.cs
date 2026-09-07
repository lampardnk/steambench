using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using MegaCrit.Sts2.Core.Nodes.Screens.Map;
using MegaCrit.Sts2.Core.Nodes.Screens;
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

    private static object? ReadProperty(object? value, string name)
    {
        try { return value?.GetType().GetProperty(name, BindingFlags.Instance | BindingFlags.Public)?.GetValue(value); }
        catch { return null; }
    }
    private static IEnumerable<Node> Descendants(Node node)
    {
        var stack = new Stack<Node>(); stack.Push(node);
        int visited = 0;
        while (stack.Count > 0 && visited++ < 12000)
        {
            var next = stack.Pop(); yield return next;
            foreach (var child in next.GetChildren()) stack.Push(child);
        }
    }
    private static string? VisibleText(Node node)
    {
        var parts = Descendants(node).OfType<Control>().Where(c => c.IsVisibleInTree())
            .Select(c => c is Label label ? label.Text : c is RichTextLabel rich ? rich.GetParsedText() : null)
            .Where(t => !string.IsNullOrWhiteSpace(t)).Distinct().Take(5);
        var text = string.Join(" | ", parts);
        return text.Length == 0 ? null : text[..Math.Min(text.Length, 360)];
    }
    private static Dictionary<string, object?> Semantic(Control control)
    {
        var data = new Dictionary<string, object?>();
        for (Node? node = control; node != null; node = node.GetParent())
        {
            if (node is NMapPoint point && point.Point != null)
            {
                data["kind"] = "map"; data["col"] = point.Point.coord.col; data["row"] = point.Point.coord.row;
                data["type"] = point.Point.PointType.ToString(); break;
            }
            if (node is NCreature creature)
            {
                data["kind"] = "target"; data["combat_id"] = creature.Entity.CombatId; break;
            }
            if (ReadProperty(node, "CardModel") is CardModel card)
            {
                data["kind"] = "card"; data["instance_id"] = CardIdentity(card); data["card"] = BuildCardInfo(card); break;
            }
            foreach (var property in new[] { "Reward", "Option", "Potion", "Relic", "Model", "Entry" })
            {
                var model = ReadProperty(node, property);
                if (model == null) continue;
                data["kind"] = property.ToLowerInvariant();
                data["model_id"] = ReadProperty(model, "Id")?.ToString();
                data["title"] = ReadProperty(ReadProperty(model, "Title"), "FormattedText")?.ToString();
                data["description"] = ReadProperty(ReadProperty(model, "Description"), "FormattedText")?.ToString();
                break;
            }
            if (data.Count > 0) break;
            // Don't label every child with the entire room's text/model.
            if (node != control && node is Control parent && parent.FocusMode != Control.FocusModeEnum.None) break;
        }
        return data;
    }
    private static void AddFocusGraph(Dictionary<string, object?> state, Dictionary<string, object?> ui, SceneTree? tree, Control? focus)
    {
        if (tree?.Root == null) return;
        var controls = Descendants(tree.Root).OfType<Control>()
            .Where(c => c.IsVisibleInTree() && (c.FocusMode != Control.FocusModeEnum.None || c == focus)).Take(600).ToList();
        string Id(Control c) => "element-" + c.GetInstanceId();
        var ids = controls.ToDictionary(c => c.GetInstanceId(), Id);
        var list = new List<Dictionary<string, object?>>();
        foreach (var control in controls)
        {
            var reference = Semantic(control);
            var label = VisibleText(control) ?? ReadProperty(control, "TooltipText")?.ToString();
            if (reference.TryGetValue("kind", out var kind) && (string?)kind == "map") label = $"{reference["type"]} at column {reference["col"]}, row {reference["row"]}";
            if (reference.TryGetValue("card", out var cinfo) && cinfo is Dictionary<string, object?> card && card.TryGetValue("name", out var name)) label = name?.ToString();
            if (string.IsNullOrWhiteSpace(label) && reference.TryGetValue("title", out var title)) label = title?.ToString();
            // Named buttons are descriptive; generated Godot suffixes never are.
            if (string.IsNullOrWhiteSpace(label) && !control.Name.ToString().Contains('@') && control.Name.ToString().EndsWith("Button")) label = control.Name.ToString();
            var enabled = ReadProperty(control, "IsEnabled") as bool? ?? (control is BaseButton button ? !button.Disabled : true);
            var neighbors = new Dictionary<string, object?>();
            foreach (var (direction, side) in new[] { ("left", Side.Left), ("up", Side.Top), ("right", Side.Right), ("down", Side.Bottom) })
            {
                Control? neighbor = null;
                try { neighbor = control.FindValidFocusNeighbor(side); } catch { }
                neighbors[direction] = neighbor != null && ids.TryGetValue(neighbor.GetInstanceId(), out var other) ? other : null;
            }
            var rect = control.GetGlobalRect();
            list.Add(new Dictionary<string, object?> {
                ["id"] = Id(control), ["label"] = label, ["reference"] = reference,
                ["type"] = control.GetType().Name, ["visible"] = true, ["enabled"] = enabled,
                ["selectable"] = control.FocusMode != Control.FocusModeEnum.None,
                ["activation"] = control is BaseButton || control.GetType().Name.Contains("Button") || reference.Count > 0 ? "a" : null,
                ["ambiguous"] = string.IsNullOrWhiteSpace(label), ["neighbors"] = neighbors,
                ["bounds"] = new[] { (int)rect.Position.X, (int)rect.Position.Y, (int)rect.Size.X, (int)rect.Size.Y }
            });
        }
        // The semantic scene changes when its controls/options change, never merely on focus.
        var scene = JsonSerializer.Serialize(new { type = state.GetValueOrDefault("state_type"), menu = state.GetValueOrDefault("menu_screen"), nodes = list.Select(e => new { id = e["id"], label = e["label"], enabled = e["enabled"] }) });
        ui["scene_id"] = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(scene)))[..16].ToLowerInvariant();
        ui["focused_element"] = focus != null && ids.TryGetValue(focus.GetInstanceId(), out var focused) ? focused : null;
        ui["elements"] = list; ui["elements_truncated"] = controls.Count == 600;
    }

    [HarmonyPatch(typeof(McpMod), "BuildGameState")]
    private static class SteambenchObservationPatch
    {
        private static void Postfix(Dictionary<string, object?> __result)
        {
            var observation = new Dictionary<string, object?> { ["sensor_version"] = 3 };
            __result["ui"] = observation;
            try
            {
                var tree = Engine.GetMainLoop() as SceneTree;
                var focus = tree?.Root?.GuiGetFocusOwner();
                AddFocusGraph(__result, observation, tree, focus);
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
                // Map reconnaissance is available at Neow without opening or changing the UI.
                if (run?.Map != null && !__result.ContainsKey("map")) __result["map"] = BuildMapState(run);
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
                observation["encounter_id"] = CombatManager.Instance.IsInProgress && combat != null ? RuntimeHelpers.GetHashCode(combat).ToString() : null;
                var cards = player?.PlayerCombatState?.Hand.Cards;
                if (player?.PlayerCombatState is { } piles && __result.TryGetValue("player", out var pstate) && pstate is Dictionary<string, object?> pdict)
                {
                    foreach (var pair in new[] { ("draw_pile", piles.DrawPile.Cards), ("discard_pile", piles.DiscardPile.Cards), ("exhaust_pile", piles.ExhaustPile.Cards) })
                    {
                        var list = new List<Dictionary<string, object?>>();
                        foreach (var item in pair.Item2) { var info = BuildCardInfo(item); info["instance_id"] = CardIdentity(item); list.Add(info); }
                        // Membership only; never expose hidden draw order.
                        if (pair.Item1 == "draw_pile") list = list.OrderBy(item => (int)item["instance_id"]!).ToList();
                        pdict[pair.Item1] = list;
                    }
                }
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
