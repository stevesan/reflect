#pragma strict

//----------------------------------------
//  Meant to be used for MeshColliders that
// may change their mesh geometry
//----------------------------------------

function OnMeshChanged() : void {
	// Destroy the meshcollider component so it gets properly
	// re-updated, but remember it isn't
	// actually destroyed until the end of the Update
	// It will get added in the next Update
	if( gameObject.GetComponent(MeshCollider) != null )
		Destroy( gameObject.GetComponent(MeshCollider) );
}

function GetMesh() : Mesh
{
	return gameObject.GetComponent(MeshFilter).mesh;
}

function Update() {
	if( gameObject.GetComponent(MeshCollider) == null )
		gameObject.AddComponent(MeshCollider);
}
