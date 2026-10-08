# Lower limb avatar prototype

Online demo: [Open the website](https://myb-cpu666.github.io/lower-limb-avatar-demo/).

For local preview, serve this directory with any static HTTP server. In the
original workspace, double-click `start.cmd`, keep its window open, then open
http://127.0.0.1:8787/. If this address is already served, just open the page.
The page and Three.js dependencies are local; model viewing needs no external service.

This is a static HTML/JavaScript website suitable for GitHub Pages. All runtime
resources use relative paths, so the site also works under a repository URL.
The root `.nojekyll` file preserves the original static resources. Configure
Pages to publish from the `main` branch, root directory (`/`).

The page shows two Innerscene humans: a bare simulated user on the left and
a Halo-wearing digital avatar on the right. The automatic loop includes leg
raises, lateral leg swings, hip rotation, pelvis turns and diagonal leg raises
with a pelvis lean. It starts with a lateral swing and drives only the simulated
user's independent skeleton. Its local pelvis and
hip/knee joint states are copied to the digital avatar. This illustrates the
source-to-follower data flow; it is not a real sensor reconstruction.
One renderer uses two scissored views with a shared camera, so both figures stay
visible even in side view. Static geometry is shared; the two skeletons are independent.

The demo selector switches between motion following, stair ascent and stair
descent. Stair modes render six 160 mm-high, 340 mm-deep steps in both views.
Alternating foot trajectories drive planar hip/knee IK, level foot orientation
and root translation. The shared camera follows the person. Each sequence ends
on a landing, then fades and repeats. These are scripted visual demonstrations;
the selected scenario and step dimensions are not inferred from sensors.
The four original simulated-input sliders are retained; moving a slider returns
to the motion-following scene.

"Adventure / Forest Trial" adds a short playable level alongside the existing
demos. Alternating left/right leg raises advance the avatar, a higher leg raise
clears one obstacle, and three bilateral knee bends defeat the guard. Six coins,
a progress bar, scoring, a finish gate and replay complete the level. Automatic
demonstration is enabled initially; buttons or A/D/S switch to manual play.
Buttons generate simulated joint-angle pulses, which pass through the same
threshold/event recognition used by the automatic demo. The bare user stays in
place while the exoskeleton-wearing game avatar travels through the forest.
The route distance is virtual; no live sensor connection is included.

The forest now uses nine textured models from Kay Lousberg's **KayKit Forest
Nature Pack 1.0 FREE** (CC0). Models, buffers, the shared gradient texture and
the original license are local under `assets/forest`; see its `CREDITS.md`.
The game's viewport is expanded with a small simulated-user preview. Procedural
soil/grass textures, a gradient sky, distance fog, moving motes, a wood log,
star coins, a polished forest guardian and a stone finish arch complete the scene.
The movement-following and stair modes retain their two-person layout.

The exoskeleton geometry is exported from the user's FreeCAD Halo replica.
Play/pause and restore-standing controls operate the simulated input. Four
sliders are under the collapsed input-debug panel and drive the source user only.
Angle zero refers
to the initial avatar pose, not a clinically calibrated anatomical zero.
Passive joints and cloth are rigid in this prototype. This is a visual fitting
demo; sensor reconstruction, contact physics and motor control are not included.

The exterior is organized into five motion groups, each retaining its component
materials. The waist follows the pelvis; the thighs and shanks follow their
corresponding bones. Segment length and orientation are adapted to the fixed
avatar; CAD source files are preserved. Mechanical axes are placed 70 mm lateral
to anatomical joint centers for the initial fitting. CAD L/R labels use front-view
side conventions, so anatomical sides are assigned by spatial position.
The waist above the fixed motor housings is shifted forward with height, and
the thigh harness depth is increased by 22% to fit the avatar. These are visual
fitting adaptations, not changes to the original FreeCAD design. Calibration
values are near the top of `app.js` under `fitSettings`.
The page also sculpts the waist and thigh surfaces smoothly in the human's bind
pose to clear the harness. Bone positions, lengths and skin weights are retained.
This is an appearance adjustment for the fixed demo avatar; it does not represent
measured anatomy. Values are under `bodyFitSettings`; the original `human.glb`
is preserved. Recomputed normals are joined across UV seams in the shaped area.

To regenerate browser meshes locally, use `tools/export_halo.py` with FreeCAD's
Python and the local CAD source (the export helper is excluded from publication):

```powershell
& '<FreeCAD install>\bin\python.exe' .\tools\export_halo.py '<path to Halo replica.FCStd>' .\assets
```

An automatic startup check exercises independent skeletons, state following,
the demo motion sampler, one-sided motion, maximum demo angles, knee connection
and pose restoration. A failed check leaves a visible error.

## Sources and licenses

- Human: [Innerscene human base mesh](https://www.innerscene.com/tools/library/3d-parts/human-base-mesh-with-editable-53-bone-rig-8e7c8ab1).
  CC0, described by its publisher as a MakeHuman/MPFB-based model.
  Original rigged GLB retained; uniform gray material is applied in the page.
- Exoskeleton: user's FreeCAD Halo replica, an estimated exterior, not official CAD.
- Renderer: Three.js 0.186.1, MIT; license included under `vendor/three/LICENSE`.

