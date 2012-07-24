#pragma strict

var anim : tk2dAnimatedSprite = null;
var player : PlayerControl = null;

private var lastJumpDir = 0;

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

	if( player.state == PlayerState.Idle ) {
		PlayIdem('idle');
		lastJumpDir = 0;
	}
	else if( player.state == PlayerState.Walking ) {
		lastJumpDir = 0;
		if( walk < 0.0 )
			PlayIdem('walkLeft');
		else if( walk > 0.0 )
			PlayIdem('walkRight');
	}
	else if( player.state == PlayerState.Jumping ) {
		if( walk != 0 ) {
			lastJumpDir = walk;
		}
		// don't modify the last jump dir if the player didn't want to move
		if( lastJumpDir < 0.0 )
			PlayIdem('jumpLeft');
		else if( lastJumpDir > 0.0 )
			PlayIdem('jumpRight');
		else
			PlayIdem('jumpStraight');
	}

}