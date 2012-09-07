#pragma strict

var controller : GameController;

function OnTriggerExit( other:Collider ) : void
{
	var player = other.GetComponent(PlayerControl);
	if( player != null ) {
		Debug.Log('player fallout');
		controller.SendMessage('OnPlayerFallout');
	}
}
