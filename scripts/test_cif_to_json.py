import os
import json
import unittest
import tempfile
import sys

# Ensure we can import from the current directory
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cif_to_json import parse_cif, frac_to_cart, center_atoms, get_bonds, to_json_format

class TestCifToJson(unittest.TestCase):
    def setUp(self):
        # Create a temporary file to simulate a comprehensive CIF scenario
        self.test_dir = tempfile.TemporaryDirectory()
        self.cif_path = os.path.join(self.test_dir.name, "test.cif")
        self.json_path = os.path.join(self.test_dir.name, "test.json")
        
        cif_content = """data_test
loop_
_space_group_symop_operation_xyz
x,y,z
-x,-y,-z
x,y+1/2,z

loop_
_cell_length_a                   10.0(2)
_cell_length_b                   10.0(2)
_cell_length_c                   10.0(2)
_cell_angle_alpha                90.0
_cell_angle_beta                 90.0
_cell_angle_gamma                90.0

loop_
_atom_site_label
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
Cu1 0.1(5) 0.2(1) 0.3
O2 0.3(2) 0.2 0.3
"""
        with open(self.cif_path, "w") as f:
            f.write(cif_content)

    def tearDown(self):
        self.test_dir.cleanup()

    def test_parse_and_expand_symmetry(self):
        # Tests that symops correctly duplicate asymmetric atoms according to the symop rules
        # And tests that parenthesis like '(5)' representing uncertainty are correctly stripped out.
        cell, atoms = parse_cif(self.cif_path)
        
        # 1. Test Cell parameters extraction despite the "(2)" uncertainty string
        self.assertEqual(cell['a'], 10.0)
        self.assertEqual(cell['b'], 10.0)
        self.assertEqual(cell['c'], 10.0)
        self.assertEqual(cell['alpha'], 90.0)
        
        # 2. Test Symmetry Expansion
        # There are 2 distinct atoms, and 3 symmetry ops. 
        # (x,y,z), (-x,-y,-z), (x, y+1/2, z) -> 3 * 2 = 6 atoms
        self.assertEqual(len(atoms), 6)
        
        types = [a['t'] for a in atoms]
        self.assertEqual(types.count('Cu'), 3)  # Cu1 resolved to Cu
        self.assertEqual(types.count('O'), 3)   # O2 resolved to O
        
        fracts = [(a['fx'], a['fy'], a['fz']) for a in atoms]
        
        # x,y,z
        self.assertIn((0.1, 0.2, 0.3), fracts)
        # -x,-y,-z modulo operations applied: 1.0 - 0.1 = 0.9
        self.assertIn((0.9, 0.8, 0.7), fracts)
        # x,y+1/2,z applied: 0.2 + 0.5 = 0.7
        self.assertIn((0.1, 0.7, 0.3), fracts)

    def test_full_cartesian_and_json_pipeline(self):
        # Integration test for frac_to_cart -> get_bonds -> center_atoms -> JSON structure
        cell, atoms = parse_cif(self.cif_path)
        cart_atoms = frac_to_cart(cell, atoms)
        
        # Check atomic radii bond logic. 
        # Cu1(0.1, 0.2, 0.3) & O2(0.3, 0.2, 0.3) evaluates to cartesian (1,2,3) & (3,2,3). Distance = 2.0 Å.
        # Max reasonable bond allowed distance between Cu & O is roughly ~2.3 - 2.5Å, so they should be bonded!
        bonds = get_bonds(cart_atoms)
        
        # Should have exactly 3 bonds since we have 3 symmetry instances of the Cu-O pair.
        self.assertEqual(len(bonds), 3)
        for b in bonds:
            self.assertAlmostEqual(b['dist'], 2.0)
            
        cart_atoms = center_atoms(cart_atoms)
        
        # Safe scale should also prevent atoms escaping coordinates. 
        to_json_format("test_model", cart_atoms, bonds, self.json_path)
        
        # Finally, verify the written JSON perfectly matches the format specifications 
        # that `app.js` depends on.
        with open(self.json_path, "r") as f:
            output = json.load(f)
            
        self.assertEqual(output["version"], 8)
        self.assertEqual(output["name"], "test_model")
        self.assertEqual(len(output["atoms"]), 6)
        self.assertEqual(len(output["bonds"]), 3)
        
        # Check required atom properties
        first_atom = output["atoms"][0]
        self.assertIn("x", first_atom)
        self.assertIn("y", first_atom)
        self.assertIn("z", first_atom)
        self.assertIn("t", first_atom)
        self.assertIn("role", first_atom)
        self.assertIn("id", first_atom)
        
        # Check required bond properties
        first_bond = output["bonds"][0]
        self.assertIn("a", first_bond)
        self.assertIn("b", first_bond)
        self.assertIn("dashed", first_bond)

if __name__ == '__main__':
    unittest.main()
