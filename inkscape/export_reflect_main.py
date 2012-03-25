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
from simpletransform import *

def getPos( node ):
	return [float(node.get('x')), float(node.get('y')) ]

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
		#print '%s %s' % (svg.get('width'), svg.get('height'))

		# get position of player and goals
		for elt in svg.iter():
			# just consider all rectangles to be game objects. Whatever.
			if elt.tag.endswith('rect'):
				pos = getPos(elt)
				mat = parseTransform( elt.get('transform') )
				if mat != None:
					applyTransformToPoint( mat, pos )
				print '%s %f %f %s %s' % (elt.get('gameObjType'), pos[0], pos[1], elt.get('width'), elt.get('height'))

		for elt in svg.iter():
			if elt.tag.endswith('path') and elt.get('gameObjType') == 'levelGeo':
				# don't support path transforms yet...
				if elt.get('transform') != None:
					sys.stderr.write('path id='+elt.get('id')+' has a transform. Not supported!')
					sys.exit(1)
				cmds = parsePath( elt.get('d') )
				print '%s %d' % (elt.get('gameObjType'), len(cmds))
				for cmd in cmds:
					line = cmd[0] + ''
					for parm in cmd[1]:
						line += ' %s' % parm
					print line

def main():
	# Create effect instance and apply it.
	effect = ExportReflectOutput()
	# Do not output the SVG - we'll print our own 
	effect.affect( sys.argv[1:], False )