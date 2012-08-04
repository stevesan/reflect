#pragma strict

var ctrl : GameController;

function Update()
{
	if( ctrl.GetIsReflecting() ) {
		renderer.enabled = true;
		transform.position = ctrl.GetMirrorPos();
		transform.eulerAngles.z = Mathf.Rad2Deg * ctrl.GetMirrorAngle();
	}
	else {
		renderer.enabled = false;
	}
}
