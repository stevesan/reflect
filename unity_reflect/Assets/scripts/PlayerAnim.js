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

function DidJump()
{
	anim.Play('jump');
}

function Update () {
	var walk = player.GetWalkingValue();
	var isJumping = (anim.isPlaying() && anim.clipId == anim.GetClipIdByName( 'jump' ));

	if( !isJumping ) {
		if( walk < 0.0 )
			PlayIdem('walkLeft');
		else if( walk > 0.0 )
			PlayIdem('walkRight');
		else
			PlayIdem('idle');
	}

}