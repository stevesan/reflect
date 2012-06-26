#pragma strict

var anim : tk2dAnimatedSprite = null;
var player : PlayerControl = null;

function Start () {

}

function PlayIdem( clip:String )
{
	var id = anim.GetClipIdByName( clip );
	if( id != anim.clipId )
		anim.Play(id);
}

function Update () {
	var walk = player.GetWalkingValue();

	if( walk < 0.0 )
		PlayIdem('walkLeft');
	else if( walk > 0.0 )
		PlayIdem('walkRight');
	else
		PlayIdem('idle');

}