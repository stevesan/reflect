#!/Library/Frameworks/Python.framework/Versions/2.7/bin/python
# Put this script in ~./config/inkscape/extensions

# Call the python script in a version controlled directory
# Replace this path with the inkscape plugin directory path
import sys
sys.path.append('/Users/stevesan84/reflect_git/inkscape')

# Call the actual plugin code
import export_reflect_main
export_reflect_main.main()