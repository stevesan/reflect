#pragma strict
@script RequireComponent(Collider)

var receiver:GameObject = null;	// sent OnGetMirror events
var onGetSound:AudioClip = null;
var flySecs:float = 0.5;
var mainCam:Camera;
var guiFlyTarget:GUIText;
var tracker : Tracking = null;

private var state = "normal";
private var flyStartTime:float;
private var flyTarget:Vector2;
private var flySource:Vector2;

function Start () {

}

function Update () {

	if( state == "flying" )
	{
		var t = (Time.time-flyStartTime) / flySecs;

		if( t < 1.0 )
			transform.position = Vector2.Lerp( flySource, flyTarget, t );
		else {
			transform.position = flyTarget;
			receiver.SendMessage("OnGetMirror", this.GetComponent(Mirror) );
		}
	}
}

function OnTriggerEnter(other : Collider) : void
{
	if( state == "normal" ) {
		var player = other.GetComponent(PlayerControl);
		if( player != null ) {
			AudioSource.PlayClipAtPoint( onGetSound, transform.position );
			state = "flying";
			flyStartTime = Time.time;
			flySource = transform.position;

			// Kick off fly animation
			var ssX = guiFlyTarget.transform.position.x * mainCam.pixelWidth;
			var ssY = guiFlyTarget.transform.position.y * mainCam.pixelHeight;
			var ray = mainCam.ScreenPointToRay( Vector3(ssX, ssY, 0 ));
			var t = (mainCam.nearClipPlane-ray.origin.z) / ray.direction.z;
			flyTarget = ray.origin + t*ray.direction;
			
			if( tracker != null )
			{
				var json = new ToStringJsonWriter();
				json.WriteObjectStart();
				json.Write("mirrorPos", Utils.ToVector2(transform.position));
				json.WriteObjectEnd();
				tracker.PostEvent( "gotMirror", json.GetString() );
			}
		}
	}
}