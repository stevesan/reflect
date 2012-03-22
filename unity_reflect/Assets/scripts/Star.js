#pragma strict
@script RequireComponent( Collider )

function Start () {

}

function Update () {

}

function OnTriggerEnter(other : Collider) : void
{
	Debug.Log('touched');
	var player = other.GetComponent(PlayerControl);
	if( player != null )
	{
		if( transform.parent != null )
			transform.parent.gameObject.SendMessage( 'OnPlayerGetStar' );

		Destroy( this.gameObject );
	}
}