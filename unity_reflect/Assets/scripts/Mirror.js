#pragma strict
@script RequireComponent(Collider)

var receiver:GameObject = null;	// sent OnGetMirror events

function Start () {

}

function Update () {

}

function OnTriggerEnter(other : Collider) : void
{
	var player = other.GetComponent(PlayerControl);
	if( player != null ) {
		receiver.SendMessage("OnGetMirror", this.GetComponent(Mirror) );
	}
}