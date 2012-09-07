#pragma strict
@script RequireComponent( Collider )

var doPerFrameSphereCheck = false;	// If true, this will do a per-frame sphere-collision check to check for player-collision

function Start () {

}

function Update () {

}

function FixedUpdate() {
	if( doPerFrameSphereCheck ) {
		var sc = GetComponent(SphereCollider);
		if( sc != null ) {
			//Debug.Log('center = '+(sc.center+transform.position));
			for( var col in Physics.OverlapSphere( sc.center+transform.position, sc.radius ) ) {
				var player = col.gameObject.GetComponent(PlayerControl);
				if( player != null ) {
					Debug.Log('sending msg with collider '+col.gameObject.name);
					if( transform.parent != null ) {
						transform.parent.gameObject.SendMessage( 'OnGetKey', this.gameObject );
					}
				}
			}
		}
	}
}

function OnCollisionEnter( collision : Collision ) : void
{
	var player = collision.gameObject.GetComponent(PlayerControl);
	if( player != null )
	{
			Debug.Log('sending msg with collider '+collision.gameObject.name);
		if( transform.parent != null ) {
			transform.parent.gameObject.SendMessage( 'OnGetKey', this.gameObject );
		}
	}
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