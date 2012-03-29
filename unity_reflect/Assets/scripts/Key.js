#pragma strict
@script RequireComponent( Collider )

function Start () {

}

function Update () {

}

function OnTriggerEnter(other : Collider) : void
{
	var player = other.GetComponent(PlayerControl);
	if( player != null )
	{
			Debug.Log('sending msg with collider '+other.gameObject.name);
		if( transform.parent != null )
		{
			transform.parent.gameObject.SendMessage( 'OnGetKey', this.gameObject );
		}
	}
}