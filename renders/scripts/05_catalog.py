import sys
sys.path.insert(0, r'C:\ASTRONI SPACEAPPS\renders\scripts')
from lib import *

scn = reset()
w = bpy.data.worlds.new('Studio'); scn.world = w; w.use_nodes = True
bgn = w.node_tree.nodes['Background']; bgn.inputs['Color'].default_value = (0.0, 0.0, 0.0, 1); bgn.inputs['Strength'].default_value = 1.0
bpy.ops.mesh.primitive_plane_add(size=400, location=(0, 0, 0)); fl = bpy.context.object
fm = bpy.data.materials.new('Floor'); fm.use_nodes = True; fb = fm.node_tree.nodes['Principled BSDF']
fb.inputs['Base Color'].default_value = (0.015, 0.017, 0.022, 1); fb.inputs['Roughness'].default_value = 0.22
fl.data.materials.append(fm)
parts = [('engine-xs', 0.625), ('engine-s', 1.25), ('engine-m-vacuum', 2.5), ('engine-l-heavy', 3.75), ('tank-m-hydrolox', 2.53), ('capsule-1', 1.25), ('capsule-2', 2.6), ('capsule-3', 3.75), ('nose-ogive-m', 2.5), ('srb-xs', 0.75), ('docking-port-s', 1.25), ('heat-shield-m', 2.5)]
total = sum(w for _, w in parts) + 0.9*(len(parts)-1)
x = -total/2
for name, wd in parts:
    imp(name, loc=(x + wd/2, 0, 0), rot=(0, 0, math.radians(-20)))
    x += wd + 0.9
area(scn, (-8, -18, 14), (0, 0, 2), 9000, size=10, color=(1.0, 0.95, 0.9))
area(scn, (14, 10, 10), (0, 0, 3), 6000, size=8, color=(0.6, 0.75, 1.0))
area(scn, (0, 25, 6), (0, 0, 3), 5000, size=12, color=(1.0, 0.7, 0.4))
camera(scn, (0, -31, 5.0), (0, 0, 1.9), lens=27)
fix_materials(); settings(scn, samples=128)
go(scn, '05-parts-catalog')
