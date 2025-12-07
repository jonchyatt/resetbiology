"""
Automated Blender render for an audio-reactive particle orb.

Run from Blender (CLI):
  blender -b -P scripts/visuals/blender_generate.py -- \
    --analysis scripts/visuals/output/analysis.json \
    --audio input.wav \
    --out renders/orb.mp4 \
    --resolution 7680 \
    --fps 30 \
    --background-video path/to/360.mp4 \
    --mask-sky \
    --mode equirect \
    --stereo

If you just want a procedural star sky, omit --background-video.
"""

import argparse
import json
import math
import sys
from pathlib import Path

try:
    import bpy  # type: ignore
except ImportError:
    print("This script must be executed inside Blender (bpy not found).")
    sys.exit(1)


def parse_args():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    else:
        argv = []

    parser = argparse.ArgumentParser(description="Generate audio-reactive orb render in Blender.")
    parser.add_argument("--analysis", type=Path, required=True, help="JSON from analyze_audio.py")
    parser.add_argument("--audio", type=Path, required=True, help="Audio file to sync/render with the video.")
    parser.add_argument("--out", type=Path, required=True, help="Output video path (mp4).")
    parser.add_argument("--resolution", type=int, default=7680, help="Horizontal resolution.")
    parser.add_argument("--resolution-y", type=int, default=None, help="Optional vertical resolution. Defaults to half for equirect or 16:9 for perspective.")
    parser.add_argument("--fps", type=int, default=30, help="Render frames per second.")
    parser.add_argument("--background-video", type=Path, default=None, help="Optional 360/equirectangular mp4 to use as the sky.")
    parser.add_argument("--mask-sky", action="store_true", help="If set, compositor will key out sky from the background video to reveal procedural stars.")
    parser.add_argument("--use_cycles", action="store_true", help="Force Cycles renderer (default uses Eevee for speed).")
    parser.add_argument("--mode", choices=["equirect", "perspective"], default="equirect", help="Camera mode: 360 equirectangular or standard perspective.")
    parser.add_argument("--fov", type=float, default=70.0, help="Perspective field of view (degrees) when mode=perspective.")
    parser.add_argument("--cam-height", type=float, default=0.0, help="Camera height offset.")
    parser.add_argument("--stereo", action="store_true", help="Enable stereo 3D (side-by-side) rendering.")
    parser.add_argument("--stereo-distance", type=float, default=0.065, help="Interocular distance for stereo (meters).")
    parser.add_argument("--stereo-format", choices=["SIDEBYSIDE", "TOPBOTTOM"], default="SIDEBYSIDE", help="Stereo packing format.")
    return parser.parse_args(argv)


def configure_render(scene: bpy.types.Scene, args):
    scene.render.engine = "CYCLES" if args.use_cycles else "BLENDER_EEVEE"
    scene.render.resolution_x = args.resolution
    if args.resolution_y:
        scene.render.resolution_y = args.resolution_y
    else:
        scene.render.resolution_y = args.resolution // 2 if args.mode == "equirect" else int(args.resolution * 9 / 16)
    scene.render.fps = args.fps
    scene.render.filepath = str(args.out)

    scene.render.image_settings.file_format = "FFMPEG"
    scene.render.ffmpeg.format = "MPEG4"
    scene.render.ffmpeg.codec = "H264"
    scene.render.ffmpeg.constant_rate_factor = "MEDIUM"
    scene.render.ffmpeg.audio_codec = "AAC"
    scene.render.ffmpeg.audio_bitrate = 320
    scene.render.ffmpeg.audio_channels = "STEREO"

    # Stereo/multiview
    scene.render.use_multiview = bool(args.stereo)
    if args.stereo:
        scene.render.views_format = "STEREO_3D"
        stereo_fmt = scene.render.stereo_3d_format
        stereo_fmt.display_mode = args.stereo_format
        stereo_fmt.use_squeezed_frame = True

    # Add audio strip so the video renders with sound.
    seq = scene.sequence_editor_create()
    seq.sequences.new_sound("Audio", str(args.audio), channel=1, frame_start=1)


def create_camera(scene: bpy.types.Scene, args):
    cam_data = bpy.data.cameras.new("RenderCamera")
    if args.mode == "equirect":
        cam_data.type = "PANO"
        cam_data.cycles.panorama_type = "EQUIRECTANGULAR"
    else:
        cam_data.type = "PERSP"
        cam_data.lens_unit = "FOV"
        cam_data.angle = math.radians(args.fov)

    if args.stereo:
        cam_data.stereo.interocular_distance = args.stereo_distance
        cam_data.stereo.convergence_mode = "PARALLEL"

    cam_obj = bpy.data.objects.new("RenderCamera", cam_data)
    cam_obj.location = (0.0, 0.0, args.cam_height)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj
    return cam_obj


def create_world(background_video: Path | None):
    world = bpy.data.worlds["World"]
    world.use_nodes = True
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    nodes.clear()

    output = nodes.new(type="ShaderNodeOutputWorld")

    if background_video:
        env_tex = nodes.new(type="ShaderNodeTexEnvironment")
        env_tex.image = bpy.data.images.load(str(background_video))
        env_tex.projection = "EQUIRECTANGULAR"
        env_tex.interpolation = "Cubic"

        background = nodes.new(type="ShaderNodeBackground")
        background.inputs["Strength"].default_value = 1.2

        links.new(env_tex.outputs["Color"], background.inputs["Color"])
        links.new(background.outputs["Background"], output.inputs["Surface"])
    else:
        noise = nodes.new(type="ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 25.0
        noise.inputs["Detail"].default_value = 16.0
        noise.inputs["Roughness"].default_value = 0.65

        color_ramp = nodes.new(type="ShaderNodeValToRGB")
        color_ramp.color_ramp.elements[0].position = 0.2
        color_ramp.color_ramp.elements[0].color = (0.0, 0.0, 0.0, 1.0)
        color_ramp.color_ramp.elements[1].position = 0.3
        color_ramp.color_ramp.elements[1].color = (1.0, 1.0, 1.0, 1.0)

        background = nodes.new(type="ShaderNodeBackground")
        background.inputs["Strength"].default_value = 1.5

        links.new(noise.outputs["Fac"], color_ramp.inputs["Fac"])
        links.new(color_ramp.outputs["Color"], background.inputs["Color"])
        links.new(background.outputs["Background"], output.inputs["Surface"])

    return world


def create_plane():
    bpy.ops.mesh.primitive_plane_add(size=100.0, location=(0.0, 0.0, -1.0))
    plane = bpy.context.active_object
    mat = bpy.data.materials.new(name="WaterLike")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output = nodes.new(type="ShaderNodeOutputMaterial")
    principled = nodes.new(type="ShaderNodeBsdfPrincipled")
    principled.inputs["Base Color"].default_value = (0.05, 0.08, 0.12, 1.0)
    principled.inputs["Metallic"].default_value = 0.0
    principled.inputs["Roughness"].default_value = 0.05
    principled.inputs["Transmission"].default_value = 0.9
    principled.inputs["IOR"].default_value = 1.333

    links.new(principled.outputs["BSDF"], output.inputs["Surface"])
    plane.data.materials.append(mat)
    return plane


def create_orb_material():
    mat = bpy.data.materials.new(name="OrbEmission")
    mat.use_nodes = True
    mat.blend_method = "BLEND"
    mat.shadow_method = "NONE"
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output = nodes.new(type="ShaderNodeOutputMaterial")
    emission = nodes.new(type="ShaderNodeEmission")
    emission.name = "OrbEmissionNode"
    emission.inputs["Strength"].default_value = 10.0

    ramp = nodes.new(type="ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (1.0, 0.95, 0.8, 1.0)
    ramp.color_ramp.elements[1].color = (1.0, 0.4, 0.05, 0.0)
    ramp.color_ramp.elements[1].position = 0.85

    geometry = nodes.new(type="ShaderNodeNewGeometry")
    multiply = nodes.new(type="ShaderNodeMath")
    multiply.operation = "MULTIPLY"
    multiply.inputs[1].default_value = 2.5

    links.new(geometry.outputs["Pointiness"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], emission.inputs["Color"])
    links.new(emission.outputs["Emission"], output.inputs["Surface"])
    return mat


def create_orb_object(material: bpy.types.Material):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, location=(0.0, 0.0, 0.6))
    orb = bpy.context.active_object

    # Geometry Nodes: emit a dense cluster of instances for a volumetric feel.
    geo_tree = bpy.data.node_groups.new("OrbGeo", "GeometryNodeTree")
    geo_tree.inputs.new("NodeSocketGeometry", "Geometry")
    geo_tree.outputs.new("NodeSocketGeometry", "Geometry")

    nodes = geo_tree.nodes
    links = geo_tree.links

    group_in = nodes.new("NodeGroupInput")
    group_out = nodes.new("NodeGroupOutput")

    ico_src = nodes.new("GeometryNodeMeshIcoSphere")
    ico_src.inputs["Radius"].default_value = 0.5
    ico_src.inputs["Subdivisions"].default_value = 3

    mesh_to_points = nodes.new("GeometryNodeMeshToPoints")
    mesh_to_points.inputs["Radius"].default_value = 0.02
    mesh_to_points.inputs["Density"].default_value = 250.0

    instance_geo = nodes.new("GeometryNodeMeshIcoSphere")
    instance_geo.inputs["Radius"].default_value = 0.03
    instance_geo.inputs["Subdivisions"].default_value = 1

    instance_on_points = nodes.new("GeometryNodeInstanceOnPoints")
    instance_on_points.inputs["Scale"].default_value = 1.0

    set_material = nodes.new("GeometryNodeSetMaterial")
    set_material.inputs["Material"].default_value = material

    realize = nodes.new("GeometryNodeRealizeInstances")

    links.new(ico_src.outputs["Mesh"], mesh_to_points.inputs["Mesh"])
    links.new(mesh_to_points.outputs["Points"], instance_on_points.inputs["Points"])
    links.new(instance_geo.outputs["Mesh"], instance_on_points.inputs["Instance"])
    links.new(instance_on_points.outputs["Instances"], set_material.inputs["Geometry"])
    links.new(set_material.outputs["Geometry"], realize.inputs["Geometry"])
    links.new(realize.outputs["Geometry"], group_out.inputs["Geometry"])

    modifier = orb.modifiers.new(name="OrbGeoNodes", type="NODES")
    modifier.node_group = geo_tree

    return orb


def apply_audio_animation(orb: bpy.types.Object, material: bpy.types.Material, analysis: dict, fps: int):
    rms = analysis["rms_normalized"]
    beats = set(analysis.get("beat_frames", []))
    sr = analysis["sample_rate"]
    hop = analysis["hop_length"]

    emission_node = material.node_tree.nodes.get("OrbEmissionNode")
    if emission_node is None:
        raise RuntimeError("Orb emission node not found; cannot animate emission strength.")

    base_scale = 0.6
    scale_boost = 1.4
    base_emission = 8.0
    emission_boost = 40.0

    frame_numbers = []
    scale_values = []
    emission_values = []

    for idx, amp in enumerate(rms):
        time_sec = (idx * hop) / sr
        frame = int(round(time_sec * fps)) + 1  # start at frame 1
        beat_push = 0.3 if idx in beats else 0.0
        intensity = min(1.0, amp + beat_push)

        frame_numbers.append(frame)
        scale_values.append(base_scale + intensity * scale_boost)
        emission_values.append(base_emission + intensity * emission_boost)

    # Keyframe object scale (uniform on all axes)
    for frame, value in zip(frame_numbers, scale_values):
        orb.scale = (value, value, value)
        orb.keyframe_insert(data_path="scale", frame=frame)

    # Keyframe emission strength
    for frame, value in zip(frame_numbers, emission_values):
        emission_node.inputs["Strength"].default_value = value
        emission_node.inputs["Strength"].keyframe_insert("default_value", frame=frame)

    max_frame = max(frame_numbers) if frame_numbers else 1
    bpy.context.scene.frame_end = max_frame


def setup_compositor(mask_sky: bool, background_video: Path | None):
    scene = bpy.context.scene
    scene.use_nodes = True
    ntree = scene.node_tree
    nodes = ntree.nodes
    links = ntree.links
    nodes.clear()

    render_layers = nodes.new("CompositorNodeRLayers")
    composite = nodes.new("CompositorNodeComposite")

    if mask_sky and background_video:
        movie = nodes.new("CompositorNodeMovieClip")
        movie.clip = bpy.data.movieclips.load(str(background_video))

        keyer = nodes.new("CompositorNodeKeying")
        keyer.inputs["Clip Black"].default_value = 0.2
        keyer.inputs["Clip White"].default_value = 0.9

        mix = nodes.new("CompositorNodeAlphaOver")
        mix.inputs["Fac"].default_value = 1.0

        links.new(movie.outputs["Image"], keyer.inputs["Image"])
        links.new(keyer.outputs["Image"], mix.inputs[1])  # background
        links.new(render_layers.outputs["Image"], mix.inputs[2])  # foreground render
        links.new(mix.outputs["Image"], composite.inputs["Image"])
    else:
        links.new(render_layers.outputs["Image"], composite.inputs["Image"])


def main():
    args = parse_args()
    analysis = json.loads(args.analysis.read_text())

    scene = bpy.context.scene
    configure_render(scene, args)
    create_world(args.background_video)
    create_plane()
    create_camera(scene, args)
    mat = create_orb_material()
    orb = create_orb_object(mat)
    apply_audio_animation(orb, mat, analysis, args.fps)
    setup_compositor(args.mask_sky, args.background_video)

    print("Starting render...")
    bpy.ops.render.render(animation=True)
    print(f"Render complete: {args.out}")


if __name__ == "__main__":
    main()
