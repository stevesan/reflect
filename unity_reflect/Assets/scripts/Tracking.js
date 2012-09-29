/*
Tracking, as in player-action tracking over the internet.
*/
#pragma strict

import LitJson;

#if UNITY_EDITOR
private var urlPrefix = "http://localhost:8000/mor/";
#else
private var urlPrefix = "http://lobotovor.herokuapp.com/mor/";
#endif

private var playerId:int = -1;
private var sessionId:int = -1;
private var state = "needPlayerId";
private var pingPeriod = 10;

class TrackingEvent
{
	var category:String;
	var dataJson:String;

	function TrackingEvent( _cat:String, _dataJson:String ) {
		category = _cat;
		dataJson = _dataJson;
	}
};

function Awake() {
}

function Start () {
	while(true) {
		if( state == "needPlayerId" ) {
			if( PlayerPrefs.HasKey("player_id") ) {
				playerId = PlayerPrefs.GetInt("player_id");
				Debug.Log("Using existing player id = " + playerId);
				state = "needSessionId";
			}
			else {
				Debug.Log("Asking for new player id..");
				var request = new WWW(urlPrefix + "new_player");
				yield request;
				Debug.Log("www returned: "+request.text);
				playerId = parseInt(request.text);
				if( playerId >= 0 ) {
					Debug.Log("OK new player id = "+playerId);
					PlayerPrefs.SetInt("player_id", playerId);
					state = "needSessionId";
				}
				else {
					// try again next loop
					state = "needPlayerId";
				}				
			}
		}
		else if( state == "needSessionId" ) {
			Debug.Log("Asking for new session id for player id " + playerId);
			request = new WWW(urlPrefix + "new_session?player_id="+playerId);
			yield request;
			if( request.error != null ) {
				Debug.Log(request.error);
			}
			else {
				sessionId = parseInt(request.text);
				if( sessionId >= 0 ) {
					Debug.Log("OK using session id = "+sessionId);
					state = "inSession";
				}
			}					
		}
		else if( state == "inSession" ) {
			// ping the server every n seconds
			yield WaitForSeconds(pingPeriod);
			request = new WWW(urlPrefix + "ping_session?session_id="+sessionId);
			// no need to yield - don't care about response
		}
	}
}

function PostEvent( category:String, json:String )
{
	if( state == "inSession" ) {
		var request = new WWW(urlPrefix + "post_event?session_id="+sessionId
			+ "&category=" + WWW.EscapeURL(category)
			+ "&data_json=" + WWW.EscapeURL(json)
			+ "&session_secs=" + Time.timeSinceLevelLoad );
		// No need to yield - don't care about response
	}
}

function Update () {
	
}