#pragma strict

var ctrl : GameController;
var render : Renderer;

function Update()
{
	if( ctrl.GetIsReflecting() ) {
		render.enabled = true;
		var z = transform.position.z;
		transform.position = ctrl.GetMirrorPos();
		transform.position.z = z;
		transform.eulerAngles.z = Mathf.Rad2Deg * ctrl.GetMirrorAngle();
	}
	else {
		render.enabled = false;
	}
}
