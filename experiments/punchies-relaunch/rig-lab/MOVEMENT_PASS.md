# Marco movement / breathing test pass

- Candidate torso uses assets/torso-lean-v2.png: smaller shallow shoulder strips and less bodybuilder mass. Generated with the built-in image tool; accepted prompt in TORSO_LEAN_PROMPT.txt. The first redraw retained too much muscle and was not installed.
- Candidate oval arms widened from 4.5 to 5.5 rig units; shoulder attachment span reduced from 78% to 72% of the original.
- Candidate hook fist path uses 72% of the original visual reach. This changes the isolated rig test only, not production combat stats or hitboxes.
- Candidate shoe headings are facing angle ±20 degrees outward.
- Candidate walking uses planted world-space shoe positions. An alternating 125 ms swing lifts the shoe; the other foot remains planted. Movement onset starts a step immediately, stops settle toward stance, and forward/back/strafe/diagonal use the same placement solver. Legs remain straight tapered connectors. Source: plantedFeet.js. Original comparison keeps old foot motion.
- Breathing dropdown: slow (2.8 seconds), fast (1.1 seconds), off. Small screen-Y bob plus about 2.2% torso and 0.8% head/hair expansion; feet stay grounded. Choice is preserved in the existing draft file, with older clients retaining it.

Validation: syntax checked; planted-foot solver checked in forward/back/strafe/diagonal for immediate start, stationary planted feet, a single swinging foot, visible lift and stop settling. Both breathing choices and hook animation inspected in the active in-app test. Existing tuning loaded without reset. Previous server stopped before its replacement was started; one rig server remains.
