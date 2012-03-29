#pragma strict
@script RequireComponent( Collider )

var lockSprite:Renderer;

function Start () {

}

function Update () {

}

function SetLocked( locked:boolean )
{
	lockSprite.enabled = locked;
}

function OnTriggerEnter(other : Collider) : void
{
	var player = other.GetComponent(PlayerControl);
	if( player != null )
	{
		if( transform.parent != null )
			transform.parent.gameObject.SendMessage( 'OnGetGoal' );
	}
}