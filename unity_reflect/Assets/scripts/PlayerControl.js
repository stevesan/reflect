#pragma strict
@script RequireComponent( Rigidbody )
@script RequireComponent( Collider )
@script RequireComponent( IsGrounded )

var eventListeners : GameObject[];
var isPlayer = true;

//----------------------------------------
//  Movement control parameters
//  TODO - refactor some of this stuff, separating sizing from movement controls
//----------------------------------------

// How fast we move in player widths per second. 4.0 was good as of 2/3/2012, but I bumped it up to 5. Applies to ground and in-air
private var maxMoveRelSpeed = 5;	

// This is how the movement actually feels. Less -> more perceived inertia
private var moveRelAccel = 25.0;

// Relative to current player width (to prevent floatiness when we're very large).
private var gravityRelMag = 40;	

// 1.0 = we jump exactly as tall as we are
private var jumpRelHeight = 1.2;

// How far down to sweep the box to see if we're on-ground or not, relative to current edge length
// If you lower this, make sure the ray* levels still work. Don't raise too high, otherwise the player will be able to "double jump" a lot
// We could use a jump cool-off period to prevent that...but keep it simple.
private var groundTestRelDist = 0.05;

// These are hard limits, ie. so we don't cause instability in the physics engine. NOT actually how the movement feels
// But, this does limit how massive objects we can move
private var maxWalkRelAccel = 100.0;
private var maxInAirRelAccel = 100.0;

// For ground-detection. How much of a slope the player can walk/jump from
private var minNormalY = 0.7;

//----------------------------------------
//  Debugging
//----------------------------------------
var debugInfiniteJump = false;
var debugWalking = false;
var debugNoGravity = false;
var debugGroundTest = false;
var debugHoldJumping = false;

//----------------------------------------
//  State for movement
//----------------------------------------
private var facingDir = 1; // 1 or -1
private var walkingValue = 0.0; // [-1,1]
private var jumpPressedPrevFrame = false;
private var currGoalSpeed = 0.0;	// the speed we are trying to achieve THIS FRAME - this can only be prevented by physics.

function GetFacingDir() {
	return facingDir;
}

function GetWalkingValue() {
	return walkingValue;
}

function Reset()
{
	rigidbody.velocity = Vector3(0,0,0);
}

function Start () {
	rigidbody.useGravity = false;
}

//----------------------------------------
//  TEMP
//----------------------------------------

var scaleGravity = false;

function GetScale():float
{
	return 1.0;
}

function GetEdgeLength():float
{
	return 1.0;
}

function AddJumpVelocity( relJumpHeight:float ) {	
	//Debug.Log("jumping");
	// We multiply by scale twice because the gravity value is also multiplied by scale..
	var h = relJumpHeight * GetScale();
	var aa = -1 * gravityRelMag * (scaleGravity ? GetScale() : 1.0 );
	var v = Mathf.Sqrt( -2*h*aa );
	var accel = Vector3.up * v/Time.deltaTime;
	//Debug.Log("goal velocity = " + v + " dt = " + Time.deltaTime + " accel = " + accel);
	// We don't use forces for jumping, because sometimes the time deltas for the next frame are not the same.
	AddVelocity( Vector3.up * v );
}

function AddVelocity( v:Vector3 )
{
	rigidbody.velocity += v;
}

function ApplyAccelerationViaForce( acc:Vector3 )
{
	rigidbody.AddForce( acc * rigidbody.mass );
}

function GetVelocity() {
	return rigidbody.velocity;
}

function ApplyGravity()
{
	if( debugNoGravity )
		return;

	ApplyAccelerationViaForce( Vector3(0,-1,0) * gravityRelMag * (scaleGravity ? GetScale():1.0) );
}

function DoPerFrameIsGroundedQuery() {
	return GetComponent(IsGrounded).QueryGroundedPerFrame();
}

function IsGroundedSweepTest()
{
	var rb = rigidbody;

	var hit : RaycastHit;
	if( rb.SweepTest( rb.transform.up*-1, hit, groundTestRelDist*GetEdgeLength() ) )
	{
		if( debugGroundTest )
		{
			Debug.DrawRay( rb.transform.position, rb.transform.up*-1, Color.red );
		}
		return hit.normal.y > minNormalY;
	}
	else
		// nothing below us close enough..for our feet to touch!
		return false;
}


function Update () {
}

function FixedUpdate()
{
	// Make sure to do this Query every frame.
	var isGrounded = IsGroundedSweepTest() || DoPerFrameIsGroundedQuery();

	if( isPlayer )
	{
		var walkThrottle = Input.GetAxisRaw ("Horizontal");
		var eventualGoalSpeed = 0.0;
		var currSpeed = GetVelocity().x;
				
		// compute our EVENTUAL goal speed
		if( Mathf.Abs(walkThrottle) > 0 ) {
			// update desired facing direction no matter what				
			facingDir = ( walkThrottle > 0 ? 1 : -1 );

			// Note that we scale our target walkspeed by current player size
			// Note that we use GetEdgeLength, NOT GetScale(), since maxMoveRelSpeed is in player-widths / sec, and edge len is meters / player-width
			eventualGoalSpeed = GetEdgeLength() * maxMoveRelSpeed * walkThrottle;

			// this pretty much just controls animation
			if( isGrounded )
				walkingValue = walkThrottle;
			else
				walkingValue = 0.0;
		}
		else
		{
			// no desired movement
			walkingValue = 0.0;
			// don't change facingDir

			// we could technically also stop in-air, but that looks/feels really weird..
			if( isGrounded ) {
				// stop when on the ground!
				eventualGoalSpeed = 0.0;
			}
			else
				// maintain current speed
				eventualGoalSpeed = currSpeed;
		}

		//----------------------------------------
		//  first check if we're actually already closer to our eventual goal 
		//  if so, then work from that speed instead.
		//  TESTCASE: bounce back and forth between left/right walls and make sure there is no "stickiness"
		//----------------------------------------
		if( Mathf.Abs( eventualGoalSpeed-currSpeed ) < Mathf.Abs( eventualGoalSpeed-currGoalSpeed ) )
		{
			// yes - just use the current actual speed then as our new goal speed
			currGoalSpeed = currSpeed;
		}
		
		//----------------------------------------
		// Adjust our goal speed to move towards the evental goal
		// compute our actual desired speed delta for this frame, based on interia-inspired moveRelAccel
		// TEST CASE: back-and-forth inertia. Jump and land "slip"
		//----------------------------------------
		var allowedDeltaMag = GetEdgeLength()*moveRelAccel * Time.deltaTime;
		var goalSpeedDelta = eventualGoalSpeed - currGoalSpeed;

		// clamp by the allowed, while maintaining sign
		// avoid div by 0..
		if( Mathf.Abs(goalSpeedDelta) > Mathf.Abs(allowedDeltaMag) )
			goalSpeedDelta = goalSpeedDelta * Mathf.Abs( allowedDeltaMag / goalSpeedDelta );

		// apply it
		currGoalSpeed += goalSpeedDelta;

		// ----------------------------------------
		// now compute the physics acceleration necessary to achieve currGoalSpeed
		// the only thing that can stop this is physics, and our own enforced max accel to prevent physics instability
		// we have this separation in order to push objects
		var speedDelta = currGoalSpeed - currSpeed;
		var idealAccel = speedDelta / Time.deltaTime;

		// Compute a force to get us our desired speed
		// Limit how much force we can exert - otherwise things may go unstable

		var accel : float;
		if( isGrounded )
			accel = Mathf.Clamp( idealAccel, -maxWalkRelAccel * GetEdgeLength(), maxWalkRelAccel * GetEdgeLength() );
		else
			accel = Mathf.Clamp( idealAccel, -maxInAirRelAccel * GetEdgeLength(), maxInAirRelAccel * GetEdgeLength() );
			
		ApplyAccelerationViaForce( transform.right * accel );

		if( debugWalking )
			Debug.Log('x speed = '+GetVelocity().x + ' scale = ' + GetScale() );
		
		//----------------------------------------
		// Jumping
		//----------------------------------------

		// We use GetButton instead of GetButtonDown because that doesn't quite behave correctly on FixedUpdate
		// Maybe we shouldn't even do jumping on the fixed update?
		if( Input.GetButton("Jump") && (!jumpPressedPrevFrame||debugHoldJumping)) {
			if( debugInfiniteJump || isGrounded )
			{
				AddJumpVelocity( jumpRelHeight );

				for( obj in eventListeners )
					obj.SendMessage ("DidJump", SendMessageOptions.DontRequireReceiver);
			}
		}
	}
	
	// keep this at the end
	jumpPressedPrevFrame = Input.GetButton("Jump");
	
	ApplyGravity();	
}