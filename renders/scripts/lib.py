
import bpy, math, os, sys
from mathutils import Vector, Matrix
M = r'C:\ASTRONI SPACEAPPS\public\models'
OUT = r'C:\ASTRONI SPACEAPPS\renders'
ARGS = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
MODE = ARGS[0] if ARGS else 'preview'
PREV = MODE == 'preview'

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    return bpy.context.scene

def imp(name, loc=(0,0,0), rot=(0,0,0), parent=None):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(M, name + '.glb'))
    new = [o for o in bpy.data.objects if o not in before]
    root = [o for o in new if o.parent is None][0]
    if parent is not None:
        root.parent = parent
    root.rotation_mode = 'XYZ'
    root.location = loc; root.rotation_euler = rot
    nodes = {}
    for o in new: nodes.setdefault(o.name.split('.')[0], o)
    return root, nodes

AX = {'X': Vector((1,0,0)), 'Y': Vector((0,0,1)), 'Z': Vector((0,-1,0))}
def pose(obj, gl_axis, deg):
    loc = obj.matrix_basis.to_translation()
    obj.matrix_basis = Matrix.Translation(loc) @ Matrix.Rotation(math.radians(deg), 4, AX[gl_axis])

def slide(obj, gl_vec):
    obj.location = obj.location + Vector((gl_vec[0], -gl_vec[2], gl_vec[1]))

def fix_materials():
    for m in bpy.data.materials:
        if not m.use_nodes: continue
        b = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if b is None: continue
        n = m.name.lower()
        col = tuple(b.inputs['Base Color'].default_value)
        if 'led' in n:
            b.inputs['Emission Color'].default_value = col
            b.inputs['Emission Strength'].default_value = 25.0
        elif 'glass' in n:
            b.inputs['Transmission Weight'].default_value = 0.85; b.inputs['Roughness'].default_value = 0.05
        elif any(k in n for k in ('steel', 'alumin', 'silver', 'titan', 'metallic', 'chrome', 'gold', 'brass', 'copper')):
            b.inputs['Metallic'].default_value = 1.0; b.inputs['Roughness'].default_value = 0.34
            if 'gold' in n: b.inputs['Base Color'].default_value = (1.0, 0.62, 0.18, 1)
        elif 'paint' in n or 'enamel' in n:
            b.inputs['Metallic'].default_value = 0.0; b.inputs['Roughness'].default_value = 0.32
        else:
            b.inputs['Metallic'].default_value = 0.0; b.inputs['Roughness'].default_value = 0.65

def stars(nt, tc, scale=420, size=0.03, gain=8.0):
    N, L = nt.nodes, nt.links
    v = N.new('ShaderNodeTexVoronoi'); v.inputs['Scale'].default_value = scale
    L.new(tc.outputs['Generated'], v.inputs['Vector'])
    r = N.new('ShaderNodeMapRange'); r.inputs['From Min'].default_value = size; r.inputs['From Max'].default_value = 0.0
    L.new(v.outputs['Distance'], r.inputs['Value'])
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 80
    L.new(tc.outputs['Generated'], nz.inputs['Vector'])
    m1 = N.new('ShaderNodeMath'); m1.operation = 'MULTIPLY'
    L.new(r.outputs['Result'], m1.inputs[0]); L.new(nz.outputs['Fac'], m1.inputs[1])
    p = N.new('ShaderNodeMath'); p.operation = 'POWER'; p.inputs[1].default_value = 4.0
    L.new(m1.outputs[0], p.inputs[0])
    g = N.new('ShaderNodeMath'); g.operation = 'MULTIPLY'; g.inputs[1].default_value = gain
    L.new(p.outputs[0], g.inputs[0])
    return g.outputs[0]

def space_world(scn, base=(0.0, 0.0, 0.0), nebula=0.06, star_gain=8.0):
    w = bpy.data.worlds.new('Space'); scn.world = w; w.use_nodes = True
    nt = w.node_tree; N, L = nt.nodes, nt.links; N.clear()
    out = N.new('ShaderNodeOutputWorld'); bg = N.new('ShaderNodeBackground')
    tc = N.new('ShaderNodeTexCoord')
    st = stars(nt, tc, gain=star_gain)
    nb = N.new('ShaderNodeTexNoise'); nb.inputs['Scale'].default_value = 2.2; nb.inputs['Detail'].default_value = 10
    L.new(tc.outputs['Generated'], nb.inputs['Vector'])
    nr = N.new('ShaderNodeValToRGB'); E = nr.color_ramp.elements
    E[0].position = 0.5; E[0].color = (base[0], base[1], base[2], 1)
    E[1].position = 0.85; E[1].color = (base[0] + nebula*0.5, base[1] + nebula*0.3, base[2] + nebula, 1)
    L.new(nb.outputs['Fac'], nr.inputs['Fac'])
    add = N.new('ShaderNodeVectorMath'); add.operation = 'ADD'
    L.new(nr.outputs['Color'], add.inputs[0]); L.new(st, add.inputs[1])
    L.new(add.outputs[0], bg.inputs['Color']); bg.inputs['Strength'].default_value = 1.0
    L.new(bg.outputs['Background'], out.inputs['Surface'])
    return w

def earth(R=400.0, center=(0, 0, -430)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=192, ring_count=96, radius=R, location=center)
    e = bpy.context.object; e.name = 'Earth'; bpy.ops.object.shade_smooth()
    m = bpy.data.materials.new('Earth'); m.use_nodes = True; nt = m.node_tree; N, L = nt.nodes, nt.links
    b = N['Principled BSDF']
    tc = N.new('ShaderNodeTexCoord')
    mp = N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1.0/R, 1.0/R, 1.0/R)
    L.new(tc.outputs['Object'], mp.inputs['Vector'])
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 1.4; nz.inputs['Detail'].default_value = 15; nz.inputs['Roughness'].default_value = 0.62
    L.new(mp.outputs['Vector'], nz.inputs['Vector'])
    land = N.new('ShaderNodeValToRGB'); E = land.color_ramp.elements
    E[0].position = 0.53; E[0].color = (0.004, 0.02, 0.09, 1)
    E[1].position = 0.545; E[1].color = (0.05, 0.09, 0.03, 1)
    e2 = E.new(0.62); e2.color = (0.22, 0.17, 0.09, 1)
    e3 = E.new(0.7); e3.color = (0.55, 0.5, 0.45, 1)
    L.new(nz.outputs['Fac'], land.inputs['Fac'])
    cz = N.new('ShaderNodeTexNoise'); cz.inputs['Scale'].default_value = 4.0; cz.inputs['Detail'].default_value = 12; cz.inputs['Distortion'].default_value = 0.8
    L.new(mp.outputs['Vector'], cz.inputs['Vector'])
    cr = N.new('ShaderNodeValToRGB'); C = cr.color_ramp.elements
    C[0].position = 0.52; C[0].color = (0, 0, 0, 1); C[1].position = 0.72; C[1].color = (1, 1, 1, 1)
    L.new(cz.outputs['Fac'], cr.inputs['Fac'])
    mix = N.new('ShaderNodeMix'); mix.data_type = 'RGBA'
    L.new(cr.outputs['Color'], mix.inputs[0]); L.new(land.outputs['Color'], mix.inputs[6]); mix.inputs[7].default_value = (0.92, 0.93, 0.96, 1)
    L.new(mix.outputs[2], b.inputs['Base Color'])
    gt = N.new('ShaderNodeMath'); gt.operation = 'GREATER_THAN'; gt.inputs[1].default_value = 0.537
    L.new(nz.outputs['Fac'], gt.inputs[0])
    mx = N.new('ShaderNodeMath'); mx.operation = 'MAXIMUM'
    L.new(gt.outputs[0], mx.inputs[0]); L.new(cr.outputs['Color'], mx.inputs[1])
    rm = N.new('ShaderNodeMapRange'); rm.inputs['To Min'].default_value = 0.18; rm.inputs['To Max'].default_value = 0.95
    L.new(mx.outputs[0], rm.inputs['Value']); L.new(rm.outputs['Result'], b.inputs['Roughness'])
    e.data.materials.append(m)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=192, ring_count=96, radius=R*1.018, location=center)
    a = bpy.context.object; a.name = 'Atmosphere'; bpy.ops.object.shade_smooth()
    am = bpy.data.materials.new('Atmosphere'); am.use_nodes = True; nt = am.node_tree; N, L = nt.nodes, nt.links; N.clear()
    out = N.new('ShaderNodeOutputMaterial'); lw = N.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = 0.25
    em = N.new('ShaderNodeEmission'); em.inputs['Color'].default_value = (0.22, 0.48, 1.0, 1); em.inputs['Strength'].default_value = 4.0
    tr = N.new('ShaderNodeBsdfTransparent'); ms = N.new('ShaderNodeMixShader')
    pw = N.new('ShaderNodeMath'); pw.operation = 'POWER'; pw.inputs[1].default_value = 3.0
    L.new(lw.outputs['Facing'], pw.inputs[0]); L.new(pw.outputs[0], ms.inputs['Fac'])
    L.new(tr.outputs[0], ms.inputs[1]); L.new(em.outputs[0], ms.inputs[2]); L.new(ms.outputs[0], out.inputs['Surface'])
    a.data.materials.append(am)
    a.visible_shadow = False
    return e

def camera(scn, loc, target, lens=35):
    c = bpy.data.objects.new('Camera', bpy.data.cameras.new('Camera')); scn.collection.objects.link(c)
    c.location = loc; c.data.lens = lens; c.data.clip_start = 0.1; c.data.clip_end = 20000
    c.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    scn.camera = c
    return c

def sun(scn, direction, strength=4.0, angle=0.5, color=(1, 0.97, 0.92)):
    l = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN')); scn.collection.objects.link(l)
    l.data.energy = strength; l.data.angle = math.radians(angle); l.data.color = color
    l.rotation_euler = Vector(direction).to_track_quat('-Z', 'Y').to_euler()
    return l

def spot(scn, loc, target, watts, deg=40, color=(1, 0.95, 0.85), size=0.5):
    l = bpy.data.objects.new('Spot', bpy.data.lights.new('Spot', 'SPOT')); scn.collection.objects.link(l)
    l.data.energy = watts; l.data.spot_size = math.radians(deg); l.data.spot_blend = 0.4; l.data.color = color; l.data.shadow_soft_size = size
    l.location = loc; l.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return l

def area(scn, loc, target, watts, size=4.0, color=(1, 1, 1)):
    l = bpy.data.objects.new('Area', bpy.data.lights.new('Area', 'AREA')); scn.collection.objects.link(l)
    l.data.energy = watts; l.data.size = size; l.data.color = color
    l.location = loc; l.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return l

def point(scn, loc, watts, color=(1, 1, 1), r=0.2):
    l = bpy.data.objects.new('Point', bpy.data.lights.new('Point', 'POINT')); scn.collection.objects.link(l)
    l.data.energy = watts; l.data.color = color; l.data.shadow_soft_size = r; l.location = loc
    return l

def settings(scn, samples=128, exposure=0.0, look='AgX - Medium High Contrast'):
    scn.render.engine = 'CYCLES'; scn.cycles.device = 'CPU'
    scn.cycles.samples = 24 if PREV else samples
    scn.cycles.use_denoising = True
    scn.cycles.max_bounces = 6
    scn.render.resolution_x, scn.render.resolution_y = (960, 540) if PREV else (1920, 1080)
    scn.render.resolution_percentage = 100
    scn.view_settings.view_transform = 'AgX'
    try: scn.view_settings.look = look
    except Exception: pass
    scn.view_settings.exposure = exposure
    scn.render.film_transparent = False

def go(scn, name):
    scn.render.filepath = os.path.join(OUT, name + ('_preview' if PREV else '') + '.png')
    bpy.ops.render.render(write_still=True)
    if not PREV:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'blend', name + '.blend'))
    print('RENDERED', scn.render.filepath)


def split_sun(scn, direction, strength=5.0, earth_objs=()):
    # one sun lights the craft (with shadows), a second lights only the Earth with no shadows,
    # so small craft never throw giant shadows onto the planet
    a = sun(scn, direction, strength)
    b = sun(scn, direction, strength); b.data.use_shadow = False
    ca = bpy.data.collections.new('LL_exclude_earth'); cb = bpy.data.collections.new('LL_only_earth')
    for o in earth_objs:
        ca.objects.link(o); cb.objects.link(o)
    try:
        a.light_linking.receiver_collection = ca
        for i in range(len(ca.collection_objects)): ca.collection_objects[i].light_linking.link_state = 'EXCLUDE'
        b.light_linking.receiver_collection = cb
        print('LIGHTLINK ok')
    except Exception as ex:
        print('LIGHTLINK failed', ex); b.hide_render = True
    return a, b
