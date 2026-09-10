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
using MegaCrit.Sts2.Core.Nodes.CommonUi;
using MegaCrit.Sts2.Core.Nodes.Rooms;
using MegaCrit.Sts2.Core.Nodes.Cards.Holders;
using MegaCrit.Sts2.Core.Nodes.Screens.CardSelection;
using MegaCrit.Sts2.Core.Nodes.Screens.Overlays;
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
    /** Declared-only walk up the hierarchy, so a protected member on a base class is still found. */
    private static PropertyInfo? FindProperty(Type? type, string name)
    {
        for (; type != null; type = type.BaseType)
        {
            var property = type.GetProperty(name, BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly);
            if (property != null) return property;
        }
        return null;
    }
    /**
     * The game does not use Godot's InputMap: every ui_* action in
     * project.godot carries an empty events array, and nothing fills them in at
     * runtime. Input goes through NControllerManager instead, which maps a
     * MegaInput action to one of these controller button names. The pad Wolf
     * gives us is an Xbox layout, so south/east/west/north are A/B/X/Y.
     * Triggers and stick presses have no equivalent in the button vocabulary
     * the executor can send, so they resolve to nothing rather than a guess.
     */
    private static readonly Dictionary<string, string> PadButtons = new()
    {
        ["controller_face_button_south"] = "a", ["controller_face_button_east"] = "b",
        ["controller_face_button_west"] = "x", ["controller_face_button_north"] = "y",
        ["controller_select_button"] = "back", ["controller_start_button"] = "start",
        ["controller_left_bumper"] = "lb", ["controller_right_bumper"] = "rb",
        ["controller_d_pad_up"] = "up", ["controller_d_pad_down"] = "down",
        ["controller_d_pad_left"] = "left", ["controller_d_pad_right"] = "right",
    };
    private static Dictionary<string, string> ControllerMap()
    {
        var map = new Dictionary<string, string>();
        try
        {
            var live = NControllerManager.Instance?.GetDefaultControllerInputMap;
            if (live == null) return map;
            foreach (var (action, button) in live)
            {
                var name = button?.ToString();
                if (action != null && name != null && PadButtons.TryGetValue(name, out var pad)) map[action.ToString()] = pad;
            }
        }
        catch { }
        return map;
    }
    // Whether the type can carry a binding at all, memoised: this is asked of
    // every visible control on every observation, and the answer never varies
    // per instance.
    private static readonly Dictionary<Type, bool> HotkeyTypes = new();
    private static bool DeclaresHotkeys(Control control)
    {
        var type = control.GetType();
        if (!HotkeyTypes.TryGetValue(type, out var declares)) HotkeyTypes[type] = declares = FindProperty(type, "Hotkeys") != null;
        return declares;
    }
    /**
     * The button that activates a control from anywhere, without moving focus.
     * Some controls cannot be reached by focus at all: NCardGrid and
     * NCardRewardSelectionScreen wire a card row's up and down neighbours back
     * to the card itself and wrap left and right within the row, so the row is
     * a closed loop by design and Skip sits outside it. The way out is the
     * button the game bound to the action, registered through the game's own
     * NButton.Hotkeys and NHotkeyManager rather than Godot's BaseButton
     * Shortcut, and resolved against the game's controller map rather than a
     * guess about which button means "cancel".
     */
    private static (List<string> Actions, string? Button) HotkeyBinding(Control control, Dictionary<string, string> controllerMap)
    {
        var actions = new List<string>();
        string? button = null;
        try
        {
            if (FindProperty(control.GetType(), "Hotkeys")?.GetValue(control) is not System.Collections.IEnumerable items) return (actions, null);
            foreach (var item in items)
            {
                var action = item?.ToString();
                if (string.IsNullOrWhiteSpace(action)) continue;
                actions.Add(action);
                if (button == null && controllerMap.TryGetValue(action, out var pad)) button = pad;
            }
        }
        catch { }
        return (actions, button);
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
    /**
     * A holder often carries no size of its own and draws through children, so
     * its own rect is a point: the three card holders on a reward screen all
     * report 0x0. The centre is still right, but nothing can be said about
     * overlap or containment, so fall back to the extent of what is drawn.
     */
    private static Rect2 SolidRect(Control control)
    {
        var rect = control.GetGlobalRect();
        if (rect.Size.X > 0 && rect.Size.Y > 0) return rect;
        var found = false;
        foreach (var child in Descendants(control).OfType<Control>())
        {
            if (child == control || !child.IsVisibleInTree()) continue;
            var childRect = child.GetGlobalRect();
            if (childRect.Size.X <= 0 || childRect.Size.Y <= 0) continue;
            rect = found ? rect.Merge(childRect) : childRect;
            found = true;
        }
        return rect;
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
        // A control that is only ever activated by its bound button has no
        // reason to be focusable, so filtering on focus alone dropped exactly
        // the controls a hotkey makes reachable - the top bar's deck, map and
        // pause buttons never appeared at all. Keep those too, and carry the
        // binding forward so it is resolved once per control rather than twice.
        var controls = new List<Control>();
        var bindings = new Dictionary<Control, (List<string> Actions, string? Button)>();
        var controllerMap = ControllerMap();
        foreach (var control in Descendants(tree.Root).OfType<Control>())
        {
            if (!control.IsVisibleInTree()) continue;
            var binding = DeclaresHotkeys(control) ? HotkeyBinding(control, controllerMap) : (new List<string>(), null);
            if (control.FocusMode == Control.FocusModeEnum.None && control != focus && binding.Actions.Count == 0) continue;
            controls.Add(control);
            bindings[control] = binding;
            if (controls.Count == 600) break;
        }
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
            // An author-given node name is descriptive; only Godot's generated
            // ones (@Control@1386) are not. This has to be broader than "ends
            // with Button": the character select buttons are named
            // IRONCLAD_button, and a control that draws its caption as art
            // rather than a Label has no visible text to read at all. Without a
            // label the element counts as ambiguous, and activate refuses it -
            // which is what stranded a run on character select.
            if (string.IsNullOrWhiteSpace(label) && !control.Name.ToString().Contains('@')) label = control.Name.ToString();
            var enabled = ReadProperty(control, "IsEnabled") as bool? ?? (control is BaseButton button ? !button.Disabled : true);
            var neighbors = new Dictionary<string, object?>();
            foreach (var (direction, side) in new[] { ("left", Side.Left), ("up", Side.Top), ("right", Side.Right), ("down", Side.Bottom) })
            {
                Control? neighbor = null;
                try { neighbor = control.FindValidFocusNeighbor(side); } catch { }
                neighbors[direction] = neighbor != null && ids.TryGetValue(neighbor.GetInstanceId(), out var other) ? other : null;
            }
            var rect = SolidRect(control);
            // The effective mode, not the raw property: Godot 4.5 resolves focus
            // through get_focus_mode_with_override, which folds in
            // focus_behavior_recursive from ancestors and can disable a whole
            // subtree. Only All is reachable with a d-pad; Click is mouse-only,
            // and reporting it as selectable made tooltips, gold and HP readouts
            // look like navigation targets.
            var focusMode = control.GetFocusModeWithOverride().ToString().ToLowerInvariant();
            var (hotkeys, press) = bindings[control];
            var element = new Dictionary<string, object?> {
                ["id"] = Id(control), ["label"] = label, ["reference"] = reference,
                ["type"] = control.GetType().Name, ["visible"] = true, ["enabled"] = enabled,
                ["focus_mode"] = focusMode, ["selectable"] = focusMode == "all",
                ["activation"] = control is BaseButton || control.GetType().Name.Contains("Button") || reference.Count > 0 ? "a" : null,
                ["ambiguous"] = string.IsNullOrWhiteSpace(label), ["neighbors"] = neighbors,
                ["bounds"] = new[] { (int)rect.Position.X, (int)rect.Position.Y, (int)rect.Size.X, (int)rect.Size.Y }
            };
            // press is what makes an unreachable control usable; hotkeys names
            // the actions behind it so a missing binding can be diagnosed.
            if (hotkeys.Count > 0) element["hotkeys"] = hotkeys;
            if (press != null) element["press"] = press;
            list.Add(element);
        }
        // The semantic scene changes when its controls/options change, never merely on focus.
        var scene = JsonSerializer.Serialize(new { type = state.GetValueOrDefault("state_type"), menu = state.GetValueOrDefault("menu_screen"), nodes = list.Select(e => new { id = e["id"], label = e["label"], enabled = e["enabled"] }) });
        ui["scene_id"] = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(scene)))[..16].ToLowerInvariant();
        ui["focused_element"] = focus != null && ids.TryGetValue(focus.GetInstanceId(), out var focused) ? focused : null;
        ui["elements"] = list; ui["elements_truncated"] = controls.Count == 600;
    }

    /**
     * Card-selection screens name their offers by model id and title only, and
     * a pile-selection screen is drawn beside the player's own hand. Both sides
     * carry reference.kind "card", so two Strikes - one in the discard pile and
     * one in hand - were indistinguishable, and the executor refused a discard
     * retrieval the game was offering with "cannot safely map card index 2 to a
     * unique screen card" (incident 1789020238941-12).
     *
     * The state builder publishes the offers in visual order, so stamping the
     * physical identity of the matching holder onto each entry makes the match
     * exact instead of a guess from a name.
     */
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
        // Same order and the same null-skip as the state builder, so index i of
        // the published list is index i here.
        int index = 0;
        foreach (var holder in holders)
        {
            if (holder.CardModel is not CardModel card) continue;
            if (index >= cards.Count) break;
            cards[index]["instance_id"] = CardIdentity(card);
            index++;
        }
    }
    [HarmonyPatch(typeof(McpMod), "BuildGameState")]
    private static class SteambenchObservationPatch
    {
        private static void Postfix(Dictionary<string, object?> __result)
        {
            var observation = new Dictionary<string, object?> { ["sensor_version"] = 6 };
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
                AddSelectionCardIdentities(__result);
            }
            catch (Exception error)
            {
                observation["error"] = error.GetType().Name;
            }
        }
    }
}
