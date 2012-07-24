#pragma strict
@script RequireComponent( Rigidbody )
@script RequireComponent( Collider )
@script RequireComponent( IsGrounded )

var eventListeners : GameObject[];
var inputEnabled = true;

var jumpSnd : AudioClip;
var landFx : ParticleSystem;
var jumpFx : ParticleSystem;

// above this Y-speed, the land sound will NOT play
var landFxMaxVelocity = -5;
var landFxOffset = Vector3(0,-0.5,0);

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

//----------------------------------------
//  Debugging
//----------------------------------------
var debugInfiniteJump = false;
var debugXSpeed = false;
var debugNoGravity = false;
var debugGroundSweep = false;
var debugGroundSweepDist = false;
var debugSecs = 0.1;
var debugColor = Color.red;
var debugHoldJumping = false;
var debugRightWall = false;
var debugLeftWall = false;

//----------------------------------------
//  State for movement
//----------------------------------------
private var walkingAnimDir = 0.0; // [-1,1]
private var jumpPressedPrevFrame = false;
private var currGoalSpeed = 0.0;	// the speed we are trying to achieve THIS FRAME - this can only be prevented by physics.
private var prevYSpeed = 0.0;
var debugMinYSpeed = 0.0;	// debugging

enum PlayerState { Idle, Walking, Jumping };

var state = PlayerState.Idle;

function GetWalkingValue() {
	return walkingAnimDir;
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
	rigidbody.velocity += Vector3.up*v;
}

function ApplyGravity()
{
	if( debugNoGravity )
		return;

	rigidbody.AddForce( rigidbody.mass * Vector3(0,-1,0) * gravityRelMag * (scaleGravity ? GetScale():1.0) );
}

function DoPerFrameIsGroundedQuery()
{
	return GetComponent(IsGrounded).QueryGroundedPerFrame();
}

function IsGroundedSweepTest() : boolean
{
	var rb = rigidbody;

	if( debugGroundSweepDist ) {
		Debug.DrawLine( rb.transform.position, rb.transform.position - (rb.transform.up*groundTestRelDist*GetEdgeLength()), debugColor, debugSecs );
	}

	var hit : RaycastHit;
	if( rb.SweepTest( rb.transform.up*-1, hit, groundTestRelDist*GetEdgeLength() ) )
	{
		var rv = hit.normal.y > GetComponent(IsGrounded).minNormalY;
		if( debugGroundSweep )
		{
			if( rv ) {
				Debug.DrawRay( hit.point, hit.normal, debugColor, debugSecs );
				Debug.Log('IsGroundedSweepTest TRUE pt = '+hit.point+' normal = ' +hit.normal);
			}
		}
		return rv;
	}
	else
		// nothing below us close enough..for our feet to touch!
		return false;
}

function IsHittingWallSweepTest( dir:Vector3, debug:boolean ) : boolean
{
	var rb = rigidbody;
	var hit : RaycastHit;

	if( rb.SweepTest( dir, hit, groundTestRelDist*GetEdgeLength() ) ) {
		// do the opposite test of the ground test
		var rv = Vector3.Dot( hit.normal, dir ) < -0.7;

		if( rv && debug ) {
			Debug.DrawRay( hit.point, hit.normal, debugColor, debugSecs );
		}

		return rv;
	}
	else
		return false;
}


function Update () {
}

//----------------------------------------
//  TEST CASES for player movement controls:
//	1) Move in one direction and release - should slip a bit after release.
//	2) Move in one dir then switch immediately - should slip a bit before changing dir
//	3) Rapidbly change dir - should not move much
//	4) While still, jump+right and release - should jump in nice arc, slip a bit on land
//	5) Run into wall and immediately switch dir - should immediately start in other dir
//	6) Stand next to ledge, jump, then tap right - should in-air accel on to ledge
//	7) Jump off in one dir, press other - should swerve in-air
//	8) Run towards a too-steep ramp - should NOT go up it
//	9) JUMP into a too-steep ramp and hold right - should NOT go up it
//----------------------------------------
function FixedUpdate()
{
	// Make sure to do this Query every frame.
	//var isGrounded = IsGroundedSweepTest() || DoPerFrameIsGroundedQuery();
	var isGrounded = DoPerFrameIsGroundedQuery();

	//----------------------------------------
	//  eventualGoalSpeed - the speed we eventually wish to achieve if player input does not change.
	//----------------------------------------
	var walkThrottle = ( inputEnabled ? Input.GetAxisRaw ("Horizontal") : 0 );
	var eventualGoalSpeed = 0.0;
	var currSpeed = rigidbody.velocity.x;

	//----------------------------------------
	//  Determine goal speed based on input
	//----------------------------------------
	if( Mathf.Abs(walkThrottle) > 0 ) {
		// it was deteremined that we can control our current speed. go for it!
		eventualGoalSpeed = GetEdgeLength() * maxMoveRelSpeed * walkThrottle;

		// signal animation state
		walkingAnimDir = ( walkThrottle > 0 ? 1 : -1 );
	}
	else {
		// no motion inputted
		walkingAnimDir = 0;	// signal the idle animation

		if( isGrounded ) {
			eventualGoalSpeed = 0.0;
		}
		else {
			// maintain current speed in air
			eventualGoalSpeed = currSpeed;
		}
	}

	//----------------------------------------
	//  first check if we're actually already closer to our eventual goal 
	//  if so, then work from that speed instead.
	//  TESTCASE: bounce back and forth between left/right walls and make sure there is no "stickiness"
	//----------------------------------------
	if( Mathf.Abs( eventualGoalSpeed-currSpeed ) < Mathf.Abs( eventualGoalSpeed-currGoalSpeed ) ) {
		currGoalSpeed = currSpeed;
	}

	//----------------------------------------
	// Adjust our goal speed to move towards the evental goal
	// compute our actual desired speed delta for this frame, based on interia-inspired moveRelAccel
	// TEST CASE: back-and-forth inertia. Jump and land "slip"
	//----------------------------------------
	var maxDeltaMag = GetEdgeLength() * moveRelAccel * Time.deltaTime;
	var goalSpeedDelta = Mathf.Clamp( eventualGoalSpeed - currGoalSpeed, -maxDeltaMag, maxDeltaMag );
	currGoalSpeed += goalSpeedDelta;

	//----------------------------------------
	//  We have a desired goal speed. Try to go to it, UNLESS we're in air and we have something blocking us from the side..
	//----------------------------------------
	var canApplyForce = true;

	if( !isGrounded ) {
		// in air... only allow us to accelerate in-air AWAY from walls
		// check for walls
		var wallOnLeft = IsHittingWallSweepTest( Vector3(-1,0,0), debugLeftWall );
		var wallOnRight = IsHittingWallSweepTest( Vector3(1,0,0), debugRightWall );
		var rightStopped = currGoalSpeed > 0.0 && wallOnRight;
		var leftStopped = currGoalSpeed < 0.0 && wallOnLeft;
		canApplyForce = !( rightStopped || leftStopped );
	}
	else
		// on ground - can always apply force
		canApplyForce = true;

	if( canApplyForce ) {
		//----------------------------------------
		// We're on the ground, OR we have a valid in-air acceleration.
		// Compute a force to get us our desired speed
		// Limit how much force we can exert - otherwise things may go unstable
		// The only thing that can stop this is physics, and our own enforced max accel to prevent physics instability
		// We have this separation in order to push objects
		//----------------------------------------
		var idealAccel = (currGoalSpeed - currSpeed) / Time.deltaTime;
		var maxAccelMag = GetEdgeLength() * ( isGrounded ? maxWalkRelAccel : maxInAirRelAccel );
		var accel = Mathf.Clamp( idealAccel, -maxAccelMag, maxAccelMag );
		rigidbody.AddForce( rigidbody.mass * transform.right * accel );
	}

	if( debugXSpeed )
		Debug.Log('x speed = '+ rigidbody.velocity.x + ' scale = ' + GetScale() );

	//----------------------------------------
	// Jumping
	//----------------------------------------

	// We use GetButton instead of GetButtonDown because that doesn't quite behave correctly on FixedUpdate. Sometimes it fires multiple times..probably because Input state is synchronized to fixed updates!
	// Maybe we shouldn't even do jumping on the fixed update? Just set a flag in input..
	if( (inputEnabled ? Input.GetButton("Jump") : false) && (!jumpPressedPrevFrame||debugHoldJumping)) {
		if( debugInfiniteJump || isGrounded )
		{
			AddJumpVelocity( jumpRelHeight );

			for( obj in eventListeners )
				obj.SendMessage ("DidJump", SendMessageOptions.DontRequireReceiver);

			//----------------------------------------
			//  Effects
			//----------------------------------------
			if( jumpSnd != null )
				AudioSource.PlayClipAtPoint( jumpSnd, transform.position );
			if( jumpFx != null ) {
				jumpFx.Play();
			}
		}
	}

	//----------------------------------------
	//  Play land sound..?
	//----------------------------------------
	if( isGrounded && prevYSpeed < landFxMaxVelocity ) {
		if( landFx != null ) {
			landFx.transform.position = transform.position + landFxOffset;
			landFx.Play();
		}
	}
	prevYSpeed = rigidbody.velocity.y;
	debugMinYSpeed = Mathf.Min( prevYSpeed, debugMinYSpeed );

	// keep this at the end
	jumpPressedPrevFrame = Input.GetButton("Jump");

	ApplyGravity();	

	//----------------------------------------
	//  Update state
	//----------------------------------------
	if( isGrounded ) {
		if( walkThrottle == 0.0 ) {
			state = PlayerState.Idle;
		}
		else {
			state = PlayerState.Walking;
		}
	}
	else {
		state = PlayerState.Jumping;
	}
}