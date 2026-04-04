import sys
import json
import math
import re
import argparse

def parse_cif(file_path):
    with open(file_path, 'r') as f:
        content = f.read()

    # extract cell parameters
    cell = {}
    for param in ['a', 'b', 'c', 'alpha', 'beta', 'gamma']:
        m = re.search(r'_cell_(?:length|angle)_%s\s+([\d\.]+)' % param, content)
        if m:
            cell[param] = float(m.group(1))

    # extract loop data
    loops = content.split('loop_')[1:]
    atoms = []
    
    for loop in loops:
        lines = loop.strip().split('\n')
        headers = []
        data = []
        for line in lines:
            line = line.strip()
            if not line or line.startswith('#'): continue
            if line.startswith('_'):
                headers.append(line.split()[0]) # split in case there are trailing spaces
            else:
                data.append(line.split())
        
        if '_atom_site_fract_x' in headers:
            idx_x = headers.index('_atom_site_fract_x')
            idx_y = headers.index('_atom_site_fract_y')
            idx_z = headers.index('_atom_site_fract_z')
            idx_type = headers.index('_atom_site_type_symbol') if '_atom_site_type_symbol' in headers else headers.index('_atom_site_label')
            
            for row in data:
                if len(row) < max(idx_x, idx_y, idx_z, idx_type): continue
                t = row[idx_type]
                t = re.sub(r'[0-9]+', '', t) # remove numbers e.g. O1 -> O
                x = float(row[idx_x].split('(')[0])
                y = float(row[idx_y].split('(')[0])
                z = float(row[idx_z].split('(')[0])
                atoms.append({'t': t, 'fx': x, 'fy': y, 'fz': z})
                
    # Extract symmetry operations
    symops = []
    in_sym = False
    for line in content.split('\n'):
        line = line.strip()
        if line.startswith('_symmetry_equiv_pos_as_xyz') or line.startswith('_space_group_symop_operation_xyz'):
            in_sym = True
            continue
        if in_sym:
            if line.startswith('_') or line.startswith('loop_') or line.startswith('data_'):
                in_sym = False
                continue
            if not line or line.startswith('#'): continue
            
            if "'" in line:
                op = line.split("'")[1]
            elif '"' in line:
                op = line.split('"')[1]
            else:
                op = "".join(line.split()[1:]) if len(line.split()) > 1 else line.split()[0]
            op = op.replace(" ", "").lower()
            symops.append(op)
            
    if not symops:
        symops = ["x,y,z"]
        
    # Apply symmetry operations
    expanded_atoms = []
    seen = set()
    
    for a in atoms:
        for op in symops:
            s_op = op.replace('x', f'({a["fx"]})').replace('y', f'({a["fy"]})').replace('z', f'({a["fz"]})')
            try:
                parts = s_op.split(',')
                nx = eval(parts[0]) % 1.0
                ny = eval(parts[1]) % 1.0
                nz = eval(parts[2]) % 1.0
                
                # Check for floating point issues making it exactly 1.0 which is 0.0
                if nx >= 0.999: nx = 0.0
                if ny >= 0.999: ny = 0.0
                if nz >= 0.999: nz = 0.0
                
                nx_r = round(nx, 3)
                ny_r = round(ny, 3)
                nz_r = round(nz, 3)
                
                key = (nx_r, ny_r, nz_r, a['t'])
                if key not in seen:
                    seen.add(key)
                    expanded_atoms.append({'t': a['t'], 'fx': nx, 'fy': ny, 'fz': nz})
            except Exception:
                pass
                
    return cell, expanded_atoms

def frac_to_cart(cell, atoms):
    a = cell.get('a', 1.0)
    b = cell.get('b', 1.0)
    c = cell.get('c', 1.0)
    alpha = math.radians(cell.get('alpha', 90.0))
    beta = math.radians(cell.get('beta', 90.0))
    gamma = math.radians(cell.get('gamma', 90.0))
    
    cos_alpha = math.cos(alpha)
    cos_beta = math.cos(beta)
    cos_gamma = math.cos(gamma)
    sin_gamma = math.sin(gamma)
    
    v = math.sqrt(max(0, 1 - cos_alpha**2 - cos_beta**2 - cos_gamma**2 + 2*cos_alpha*cos_beta*cos_gamma))
    
    # Transformation matrix
    M11 = a
    M12 = b * cos_gamma
    M13 = c * cos_beta
    M21 = 0
    M22 = b * sin_gamma
    M23 = c * (cos_alpha - cos_beta * cos_gamma) / sin_gamma
    M31 = 0
    M32 = 0
    M33 = c * v / sin_gamma
    
    for atom in atoms:
        fx = atom['fx']
        fy = atom['fy']
        fz = atom['fz']
        atom['x'] = M11*fx + M12*fy + M13*fz
        atom['y'] = M21*fx + M22*fy + M23*fz
        atom['z'] = M31*fx + M32*fy + M33*fz
        
    return atoms

def get_bonds(atoms):
    radii = {
        'H': 0.31,
        'C': 0.76,
        'O': 0.73,
        'N': 0.71,
        'Cu': 1.32,
        'Zn': 1.22
    }
    
    bonds = []
    n = len(atoms)
    for i in range(n):
        for j in range(i+1, n):
            dx = atoms[i]['x'] - atoms[j]['x']
            dy = atoms[i]['y'] - atoms[j]['y']
            dz = atoms[i]['z'] - atoms[j]['z']
            dist = math.sqrt(dx*dx + dy*dy + dz*dz)
            
            ri = radii.get(atoms[i]['t'], 0.7)
            rj = radii.get(atoms[j]['t'], 0.7)
            
            if dist < (ri + rj + 0.4) and dist > 0.4:
                dashed = False
                if atoms[i]['t'] == 'Cu' and atoms[j]['t'] == 'Cu':
                    dashed = True
                bonds.append({"a": i, "b": j, "dashed": dashed, "dist": dist})
                    
    return bonds

def center_atoms(atoms):
    if not atoms:
        return atoms
    # calculate the geometrical center
    cx = sum(a['x'] for a in atoms) / len(atoms)
    cy = sum(a['y'] for a in atoms) / len(atoms)
    cz = sum(a['z'] for a in atoms) / len(atoms)
    
    # shift origin
    for atom in atoms:
        atom['x'] -= cx
        atom['y'] -= cy
        atom['z'] -= cz
        
    return atoms

def to_json_format(name, atoms, bonds, out_file):
    output = {
        "version": 8,
        "name": name,
        "atoms": [],
        "bonds": [{"a": b["a"], "b": b["b"], "dashed": b.get("dashed", False)} for b in bonds]
    }
    
    for i, a in enumerate(atoms):
        # We assign a default role based on the atom type
        output["atoms"].append({
            "x": round(a["x"], 4),
            "y": round(a["y"], 4),
            "z": round(a["z"], 4),
            "t": a["t"],
            "role": a["t"],
            "plane": "",
            "id": i
        })
        
    with open(out_file, 'w') as f:
        json.dump(output, f, indent=2)
    print(f"Successfully wrote {len(atoms)} atoms and {len(bonds)} bonds to {out_file}")

def main():
    parser = argparse.ArgumentParser(description="Convert CIF to JSON format")
    parser.add_argument("input_cif", help="Path to input CIF file")
    parser.add_argument("output_json", help="Path to output JSON file")
    args = parser.parse_args()
    
    cell, atoms = parse_cif(args.input_cif)
    if not atoms:
        print("No atoms found in the CIF file.")
        sys.exit(1)
        
    atoms = frac_to_cart(cell, atoms)
    atoms = center_atoms(atoms)
    bonds = get_bonds(atoms)
    
    # Check spatial bounds to prevent negative perspective values in app.js (per = 14)
    # the maximum radius from origin should comfortably be smaller than 14.
    max_radius = max((a['x']**2 + a['y']**2 + a['z']**2)**0.5 for a in atoms) if atoms else 0
    safe_radius = 10.0
    if max_radius > safe_radius:
        scale_factor = safe_radius / max_radius
        for atom in atoms:
            atom['x'] *= scale_factor
            atom['y'] *= scale_factor
            atom['z'] *= scale_factor
        
        # update bonds if we want distances to reflect real life or not? 
        # app.js relies on visual distances. 
    
    # Extract name from filename roughly
    name = args.input_cif.split('/')[-1].replace('.cif', '')
    
    to_json_format(name, atoms, bonds, args.output_json)

if __name__ == "__main__":
    main()
