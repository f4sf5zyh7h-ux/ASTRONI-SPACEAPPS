import sys
sys.path.insert(0, r'C:\ASTRONI SPACEAPPS\renders\scripts')
from lib import *

scn = reset()
w = bpy.data.worlds.new('Sky'); scn.world = w; w.use_nodes = True
bgn = w.node_tree.nodes['Background']; bgn.inputs['Color'].default_value = (0.55, 0.7, 1.0, 1); bgn.inputs['Strength'].default_value = 0.5
imp('factory'); imp('rocket-stand')
z = 1.02
for name, h in [('engine-m-booster', 2.0), ('tank-m-long', 7.9), ('tank-m-short', 3.2), ('heat-shield-m', 0.4), ('capsule-2', 3.5)]:
    imp(name, loc=(0, 0, z)); z += h
TX = [-28.0, -19.3, -10.6, 0.0, 10.6, 19.3, 28.0]
for i in range(6):
    x = (TX[i] + TX[i+1])/2
    for zg in (-16.0, -8.0, 0.0, 8.0, 16.0):
        area(scn, (x, -zg, 42.9), (x, -zg, 0), 2200, size=1.0, color=(1.0, 0.96, 0.9))
sun(scn, (0.35, 0.25, -0.9), strength=2.5, angle=1.0)
camera(scn, (-25.0, -23.5, 11.0), (3.0, 9.0, 12.0), lens=20)
fix_materials(); settings(scn, samples=128, exposure=-0.8)
go(scn, '03-factory')
