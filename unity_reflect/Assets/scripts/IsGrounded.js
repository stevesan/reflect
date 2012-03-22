
var minNormalY = 0.7;

private var isGrounded = false;

function FixedUpdate() : void
{
	// Make sure we never sleep so we don't stop getting Stay messages
	if( rigidbody.IsSleeping() )
		rigidbody.WakeUp();
}

function OnCollisionStay( col : Collision ) : void
{
	// no need to check this collision if we're already on ground
	if( isGrounded ) return;

	for( var c : ContactPoint in col.contacts )
	{

		// see if we hit anything below us?
		// The normal is inward-facing, but relative to THIS RB.
		if( c.normal.y > minNormalY )
		{
			isGrounded = true;
			break;
		}
	}
}

function OnCollisionEnter( col : Collision ) : void
{
	OnCollisionStay( col );
}

// Call this function ONCE PER FRAME! You must call it! DO NOT NOT CALL IT!
// Call it even if you don't use it.
// It will reset the flag every frame, so keep your own copy for the current frame.
function QueryGroundedPerFrame() : boolean
{
	var rv = isGrounded;
	isGrounded = false;

	return rv;
}

