
import bpy, sys, json
argv = sys.argv[sys.argv.index('--')+1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.usd_import(filepath=argv[0])
out = {}
for m in bpy.data.materials:
    col = None
    if m.use_nodes:
        for n in m.node_tree.nodes:
            if n.type == 'BSDF_PRINCIPLED':
                col = [round(x,3) for x in n.inputs['Base Color'].default_value]
    out[m.name] = [col, [o.name for o in bpy.data.objects if o.type=='MESH' and m.name in [s.name for s in o.data.materials]][:6]]
print('RESULT', json.dumps(out))
