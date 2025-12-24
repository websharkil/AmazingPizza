# TASK
You are building a kids pizza game using Phaser 3.
Target audience: 5–6 year olds.
Platform: tablet (touch) + desktop (mouse). No keyboard.

Follow the specification below exactly.
Do not invent new mechanics.
Use simple, readable Phaser 3 code.

Project goal

Build a cartoony, friendly pizza shop game for ~5–6 year olds with two scenes:

Counter: customer arrives, shows order in a speech bubble, player confirms to start cooking.

Kitchen: spread dough → add toppings by pick-up + sprinkle / smear → conveyor oven (camera pans) → cut → box → return to counter → serve → customer reaction.

Platform: tablet touch + desktop mouse. No keyboard.
UI should be graphical, not text-heavy (only minimal “1–2 words” customer response).

Tech stack

Phaser 3 (single page webapp)

Assets: background images + customer sprites + ingredient spritesheets (provided separately).

Use Scale.FIT + CENTER_BOTH for responsive layout.

File structure

Create this structure:

/pizza-game
  index.html
  game.js
  /assets
    /bg
      counter_bg.png
      kitchen_bg_wide.png
    /customers
      characters-sprite.png
    /ui
      title_logo.png
      confirm_btn.png
      next_customer_btn.png
      serve_btn.png
      bubble.png
      checkmark.png
      xmark.png
      cutter.png
      box_closed.png
      box_open.png
    /ingredients
      bowls_sprite.png
      sprinkle_sprite.png

Global game state

Create a global GameState object to pass data between scenes:

currentCustomer: { id, type, spriteKey }

currentOrder: { ingredients: string[] } (1–4 random, no duplicates)

madePizza: { ingredients: Set<string>, baked: boolean, cut: boolean, boxed: boolean }

score (optional)

Define INGREDIENTS list (10 items):
["olives","sauce","cheese","mushrooms","peppers","spinach","sausage","onions","pepperoni","pineapple"]

Rules:

Sauce + cheese are smeared (drag gesture over pizza surface).

Others are sprinkled (pick up → sprinkle animation frames → drop pieces onto pizza).

Input model (touch + mouse)

Use unified pointer input:

pointerdown, pointermove, pointerup

Use Phaser setInteractive() with explicit hit areas for reliability.

No keyboard events at all.

Scene 1: CounterScene
Layout

Background: counter_bg.png (landscape).

Customer spawn zone: center area in front of counter. the customer images are in a customers_sprite.png, which you must parse to 4 individual customers images.

Speech bubble near customer head: bubble.png with ingredient icons, not text.

Flow

On scene start, show calm counter background and title.

Spawn a customer (randomly pick from characters_sprite.png man/woman/boy/girl, optionally random tint/accessory).

Generate random order: choose 1–4 ingredients.

Display order in a bubble using small ingredient icons (not text).

If you don’t have icons yet, temporarily use small colored circles + ingredient label only during dev, but remove labels later.

Show only one big graphical button: Confirm / Start (confirm_btn.png).

On confirm:

Store order + customer in GameState

Transition to KitchenScene.

Serve step (returning from kitchen)

When coming back from kitchen:

Show customer again.

Show a big serve_btn.png.

On serve:

Compare GameState.madePizza.ingredients vs GameState.currentOrder.ingredients

If exact match: “SUPER HAPPY” face + 1–2 word bubble (“Yay!”, “Yummy!”)

Else: neutral/sad face + 1–2 word bubble (“Oops”, “Hmm”)

Use face swap (different customer head sprite frames OR simple mouth/eyebrow overlays).

Then show next_customer_btn.png to spawn next customer and reset state.

Scene 2: KitchenScene (wide scrolling)
Background

Use kitchen_bg_wide.png (same height as counter bg; width ≥ 2x).

Camera will pan horizontally during oven bake.

Zones (left → right)

Prep area: dough/pizza base location (empty board area).

Ingredient area: empty counter area where ingredient bowls UI will be placed programmatically.

Oven entry: belt start (pizza placed here).

Oven middle: visible bake window (pizza travels).

Oven exit: pizza comes out baked.

Packaging area: box station.

Step state machine

Implement a strict step flow:

SPREAD_DOUGH -> ADD_TOPPINGS -> MOVE_TO_OVEN -> BAKING -> CUT -> BOX -> DONE

Dough spreading mechanic

Pizza base starts small / faded.

Player “spreads” by rubbing finger/mouse over the pizza circle.

Track coverage:

Use a simple progress meter (graphical ring or fill bar).

Increase progress when pointer moves while held down inside pizza hit area.

When progress reaches 100%, auto-advance to toppings.

Toppings interaction (pick up + apply)

Render ingredient bowls in the ingredient zone using bowls_sprite.png.

For each ingredient:

Bowl is interactive.

On pointer down: create a “held ingredient” sprite attached to pointer (state 1 frames).

While dragging over pizza:

If ingredient is sauce/cheese: smear mode

On move while pressed, stamp smear decals onto pizza (state 2 smear frames).

Else sprinkle mode:

Play sprinkle animation frames (state 2).

Spawn multiple small topping pieces at pointer location with slight random scatter.

On pointer up:

If at least one stamp/piece was applied, mark ingredient as added in madePizza.ingredients.

Snap held ingredient back / destroy held sprite.

Provide kid-friendly feedback:

A “ding” sound (optional)

A little sparkle particle burst.

Oven conveyor + camera pan

When player taps “Bake” (graphical button), move pizza to oven entry point.

Start conveyor:

Tween pizza horizontally from entry → oven → exit over ~3–5 seconds.

During bake, slightly change pizza color/overlay “heat glow”.

Camera behavior:

Use this.cameras.main.startFollow(pizza, true, 0.08, 0.08)

Set camera bounds to background width.

Follow pizza during bake, then stop follow at exit and gently pan to cutting/boxing area.

Cutting mechanic

Show cutter tool sprite (cutter.png) at bottom; player drags it across pizza.

Detect cut strokes:

Require 3–4 successful strokes crossing the pizza circle.

Each stroke draws a visible cut line overlay.

When cut requirement met, advance to boxing.

Boxing mechanic

Show open box sprite (box_open.png) in packaging area.

Player drags pizza into box area (hit zone).

On drop success:

Swap to box_closed.png

Mark boxed=true

Show a big “Done” graphical button.

Return to counter

On Done:

Save GameState.madePizza

Transition back to CounterScene.

Visual/UI rules (important)

No keyboard hints.

Minimal text:

Only 1–2 word customer reaction (optional) and it should appear in a bubble.

All primary actions are large tappable buttons (48px+ logical height).

Use icons for ingredients in order bubble.

Keep animations slow and readable for kids.

Responsiveness

Use a single landscape layout for tablets.

Phaser config:

scale.mode = Phaser.Scale.FIT

autoCenter = Phaser.Scale.CENTER_BOTH

All positions should be relative (percent of width/height) or anchored to zones.

Acceptance checklist

Codex should ensure:

Customer orders 1–4 random ingredients.

Player can confirm → kitchen.

Dough spreading required before toppings.

Toppings applied via touch/mouse:

sauce/cheese smear

others sprinkle (pieces appear on pizza)

Oven conveyor moves pizza left→right, camera pans with it.

Cutting requires repeated strokes.

Boxing requires dragging pizza into box.

Return to counter and serve:

Reaction based on ingredient match.

Next customer button spawns new customer.

Implementation tip for Codex

Build in this order:

Scene switching + basic backgrounds

Order generation + bubble UI

Pizza object + ingredient apply (sprinkle/smear)

Oven conveyor + camera follow

Cut + box

Serve + reaction + loop