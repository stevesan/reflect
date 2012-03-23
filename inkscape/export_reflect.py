#!/Library/Frameworks/Python.framework/Versions/2.7/bin/python

#----------------------------------------
#  Based off the Inkscape "hello_world.py" tutorial
#----------------------------------------

# These two lines are only needed if you don't put the script directly into
# the installation directory
import sys
sys.path.append('/Applications/Inkscape.app/Contents/Resources/extensions')

# We will use the inkex module with the predefined Effect base class.
import inkex
from simplepath import *

class ExportReflectOutput(inkex.Effect):
	def __init__(self):
		inkex.Effect.__init__(self)

	def effect(self):
		"""
		Effect behaviour.
		Looks at the first path and writes it out in a simple format for my Unity scripts to parse
		"""

		# Get access to main SVG document element and get its dimensions.
		svg = self.document.getroot()

		# dimensions of SVG
		print '%s %s' % (svg.get('width'), svg.get('height'))

		# get position of player and goals
		for elt in svg.iter():
			# just consider all rectangles to be game objects. Whatever.
			if elt.tag.endswith('rect'):
				print '%s %s %s' % (elt.get('id'), elt.get('x'), elt.get('y'))


		# etree doesn't seem to parse tags as, say, 'path', but rather '{fdsfsadfs}path'
		for elt in svg.iter():
			if elt.tag.endswith('path'):
				cmds = parsePath( elt.get('d') )
				for cmd in cmds:
					line = cmd[0] + ''
					for parm in cmd[1]:
						line += ' %s' % parm
					print line

if __name__=='__main__':
	# Create effect instance and apply it.
	effect = ExportReflectOutput()
	# Do not output the SVG - we'll print our own 
	effect.affect( sys.argv[1:], False )