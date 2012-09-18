push :
	git push origin master
	git submodule foreach git push origin master

pull :
	git pull origin master
	git submodule foreach git pull origin master