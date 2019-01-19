var updateTimer=null;
var updateInterval=5000;
var updateRequestSent=false;

var seekbarTimer=null;
var seekbarUpdateInterval=100;
var seekbarElement=null;
var seekbarDurationElement=null;
var seekbarPos=0;
var seekbarDuration=0;
var seekbarDelay=100;
var seekbarDelayTimer=null;

var playlistForm=null;

var mediaTitleElement=null;

var playlistList=null;
var currentPlaylist=null;
var currentPlaylistID=null;
var currentPlaylistSelection=null;
var playlistUpdateKey=0;

var currentFilelistSelection=null;

var fileBrowser=null;

var errorArea=null;

var youtubeSearchResults=null;

var accessKey=null;

//Snippet from https://stackoverflow.com/questions/5448545/how-to-retrieve-get-parameters-from-javascript
function findGetParameter(parameterName) {
    var result = null,
        tmp = [];
    location.search
        .substr(1)
        .split("&")
        .forEach(function (item) {
          tmp = item.split("=");
          if (tmp[0] === parameterName) result = decodeURIComponent(tmp[1]);
        });
    return result;
}
//End snippet

document.addEventListener('DOMContentLoaded',function() {
    playlistList=document.getElementById("playlist-container");
    playlistList.addEventListener('click', playlistSelect);
    playlistList.addEventListener('dblclick', playlistChange);

    fileBrowser=document.getElementById("file-browser");
    fileBrowser.addEventListener('click', filelistSelect);
    fileBrowser.addEventListener('dblclick', filelistAdd);

    document.getElementById("control-buttons").addEventListener('click', controlsSubmit);

    document.getElementById("seekbar-form").addEventListener('input', seekbarInput);
    document.getElementById("seekbar-buttons").addEventListener('click', controlsSubmit);

    document.getElementById("files-radio").addEventListener('input', tabChanged);
    document.getElementById("youtube-radio").addEventListener('input', tabChanged);
    document.getElementById("raw-radio").addEventListener('input', tabChanged);

    document.getElementById("raw-form").addEventListener('submit', rawSubmit);
    document.getElementById("youtube-search-form").addEventListener('submit', youtubeSubmit);

    youtubeSearchResults=document.getElementById("youtube-search-results");

    seekbarElement=document.getElementById('seekbar');
    seekbarDurationElement=document.getElementById('seekbar-duration');
    seekbarPos=Number(seekbarElement.value);
    seekbarDuration=Number(seekbarElement.max);

    var current=null;
    if(current=document.querySelector(".playlist-item-current")) {
        currentPlaylistID=Number(current.dataset.playlistId)
    }
    playlistUpdateKey=Number(document.getElementById("playlist-container").dataset.updateKey);

    updateTimer=setInterval(updatePage, updateInterval);

    if(seekbarElement.dataset.startPaused==="false") {
        seekbarTimer=setInterval(updateSeekbar, seekbarUpdateInterval)
    }

    playlistForm=document.getElementById("playlist-form");
    mediaTitleElement=document.getElementById("media-title");

    errorArea=document.getElementById("error-area");
    errorArea.addEventListener('animationiteration', errorSlideEnd);

    accessKey=findGetParameter("key");
},false);

function sendCommand(cmd, arg, callback_func=function(){}) {
    var target='./'+cmd;

    if(arg) {
        target+='/' + arg;
    }

    if(target.indexOf('?') > -1) {
        target+='&key=';
    } else {
        target+='?key=';
    }
    target+=accessKey;

    fetch(target).then(
        function(response) {
            if(response.status !== 200) {
                addErrorBox('Error status: '+ response.status);
                callback_func(null, false);
                return;
            }

            response.json().then(function(data) {
                callback_func(data, true);
            });
        }
    ).catch(function(err) {
        addErrorBox(`Fetch error: ${err}`);
    });
}

function getUpdates() {
    updateRequestSent=true;

    fetch("./update?key="+accessKey).then(
        function(response) {
            if(response.status !== 200) {
                addErrorBox('Update error: ' + response.status);
                return;
            }

            response.json().then(function(data) {
                if(data[0]) {
                    mediaTitleElement.textContent=data[0];
                }

                if(data[1] && data[2]) {
                    seekbarElement.max=data[1];
                    seekbarDuration=data[1];


                    seekbarDurationElement.textContent=Math.floor(data[1]/60) + ":" + String(Math.floor(data[1] % 60)).padStart(2,'0');

                    seekbarElement.value=data[2];
                    seekbarPos=data[2];
                }
                
                if(data[3] !== currentPlaylistID) {
                    if(playlistList.children[0].children[currentPlaylistID]) {
                        playlistList.children[0].children[currentPlaylistID].classList.remove("playlist-item-current");
                        currentPlaylistID=data[3];
                        playlistList.children[0].children[currentPlaylistID].classList.add("playlist-item-current");
                    }
                }

                if((data[4] || data[5]) && seekbarTimer) {
                    clearInterval(seekbarTimer);
                    seekbarTimer=null;
                } else if(!(data[4] || data[5]) && !seekbarTimer) {
                    seekbarTimer=setInterval(updateSeekbar, seekbarUpdateInterval);
                }

                if(data[6] !== playlistUpdateKey) {
                    updatePlaylist();
                }
            });
        }
    ).catch(function(err) {
        addErrorBox(`Fetch error: ${err}`);
    });
}

function playlistChange(e) {
    sendCommand('set-playlist', e.target.dataset.playlistId, function(data, success) {
        if(success) {
            getUpdates();

            if(playlistList.children[0].children[currentPlaylistID]) {
                playlistList.children[0].children[currentPlaylistID].classList.remove("playlist-item-current");
                currentPlaylistID=Number(e.target.dataset.playlistId);
                playlistList.children[0].children[currentPlaylistID].classList.add("playlist-item-current");
            }
        }
    });
}

function seekbarInput(e) {
    clearTimeout(seekbarDelayTimer);
    seekbarDelayTimer=setTimeout(sendCommand, seekbarDelay, "seek", e.target.value)
}
function updatePage() {
    getUpdates();
}

function updateSeekbar() {
    seekbarPos=Number(seekbarElement.value) + (seekbarUpdateInterval/1000);

    if(seekbarPos > seekbarDuration) {
        seekbarPos=seekbarDuration;
    }
    seekbarElement.value=seekbarPos;
}

function stopSeekbarScroll() {
    if(seekbarTimer) {
        clearInterval(seekbarTimer);
        seekbarTimer=null;
    }
}

function pause() {
    sendCommand("cycle","pause", function(data, success) {
        if(success) {
            if(seekbarTimer) {
                clearInterval(seekbarTimer);
                seekbarTimer=null;
            } else {
                seekbarTimer=setInterval(updateSeekbar, seekbarUpdateInterval)
            }
        }
    });
}

function filelistSelect(e) {
    var target=e.target
    if(!target.dataset.filePath) {
        if(!target.parentElement.dataset.filePath) {
            return;
        } else {
            target=target.parentElement;
        }
    }
    if(currentFilelistSelection) {
        currentFilelistSelection.classList.remove("filelist-item-selected");
    }
    currentFilelistSelection=target;
    currentFilelistSelection.classList.add("filelist-item-selected");
}
function filelistAdd(e) {
    var target=e.target
    if(!target.dataset.filePath) {
        if(!target.parentElement.dataset.filePath) {
            return;
        } else {
            target=target.parentElement;
        }
    }
    if(currentFilelistSelection) {
        currentFilelistSelection.classList.remove("filelist-item-selected");
    }
    currentFilelistSelection=target;
    currentFilelistSelection.classList.add("filelist-item-selected");

    sendCommand("play?file="+currentFilelistSelection.dataset.filePath, null, function(data, success) {
        if(success) {
            updatePlaylist();
        }
    });
}
function playlistSelect(e) {
    if(e.target.id==="playlist-list" || e.target.id==="playlist-container") {
        return;
    }
    if(currentPlaylistSelection) {
        currentPlaylistSelection.classList.remove("playlist-item-selected");
    }
    currentPlaylistSelection=e.target;
    currentPlaylistSelection.classList.add("playlist-item-selected");
}
function updatePlaylist() {
    sendCommand("formatted-playlist", null, function(data, success) {
        if(success) {
            currentPlaylistSelection=null;
            document.getElementById("playlist-container").innerHTML=data[0];
            playlistUpdateKey=data[1];
        }
    });
}
function controlsSubmit(e) {
    if(e.target.nodeName!=="BUTTON") {
        return;
    }
    switch(e.target.dataset.function) {
        case "refresh":
            updatePlaylist();
            break;
        case "remove":
            if(currentPlaylistSelection) {
                sendCommand("del-playlist", currentPlaylistSelection.dataset.playlistId, function(data, success) {
                    if(success) {
                        updatePlaylist();
                    }
                });
            }
            break;
        case "play-now":
            if(currentPlaylistSelection) {
                sendCommand("set-playlist", currentPlaylistSelection.dataset.playlistId, function(data, success) {
                    if(success) {
                        updatePlaylist();
                    }
                });
            }
            break;
        case "play-next":
            sendCommand("next", null, function(data, success) {
                if(success) {
                    updatePlaylist();
                }
            });
            break;
        case "play-prev":
            sendCommand("prev", null, function(data, success) {
                if(success) {
                    updatePlaylist();
                }
            });
            break;
        case "add":
            if(currentFilelistSelection) {
                sendCommand("play?file="+currentFilelistSelection.dataset.filePath, null, function(data, success) {
                    if(success) {
                        updatePlaylist();
                    }
                });
            }
            break;
        case "pause":
            pause();
            break;
    }
}
function tabChanged(e) {
    if(currentFilelistSelection) {
        currentFilelistSelection.classList.remove("filelist-item-selected");
        currentFilelistSelection=null;
    }
}

function rawSubmit(e) {
    e.preventDefault();

    sendCommand("play?file="+e.target.elements['filepath'].value, null, function(data, success) {
        if(success && data['error']==="success") {
            updatePlaylist();
        }
    });
    e.target.reset();
}

function youtubeSubmit(e) {
    e.preventDefault();

    fetch("https://www.googleapis.com/youtube/v3/search?key="+ youtubeApiKey +"&part=snippet&maxResults=25&type=video&q="+e.target.elements['query'].value).then(
        function(response) {
            if(response.status !== 200) {
                addErrorBox('Error status: '+ response.status);
                return;
            }

            response.json().then(function(data) {
                createYoutubeList(data);
            });
        }
    ).catch(function(err) {
        addErrorBox(`Fetch error: ${err}`);
    });
    
    e.target.reset();
}
function createYoutubeList(data) {
    youtubeSearchResults.innerHTML="";

    data['items'].forEach(function(e) {
        var item=document.createElement("LI");
        item.classList.add("yt-result");
        item.dataset.filePath="https://youtu.be/"+e.id.videoId

        var thumb=document.createElement("IMG");
        thumb.src=e['snippet']['thumbnails']['default']['url'];
        thumb.classList.add("yt-thumbnail");

        var title=document.createElement("P");
        title.innerText=e['snippet']['title'];
        title.classList.add("yt-title");

        var desc=document.createElement("P");
        desc.innerText=e['snippet']['description'];
        desc.classList.add("yt-description");

        var uploader=document.createElement("P");
        uploader.innerText=e['snippet']['channelTitle'];
        uploader.classList.add("yt-uploader");

        item.appendChild(thumb);
        item.appendChild(title);
        item.appendChild(desc);
        item.appendChild(uploader);
        youtubeSearchResults.appendChild(item);

        if(title.offsetWidth > item.offsetWidth - 125) {
            title.classList.add("marquee");

/*            var duration=0;
            duration=1-(100*(1/title.offsetWidth));
            console.log(duration);
            duration=8*duration;
            title.style.animationDuration=duration+"s";*/
        }
    });
}

function addErrorBox(msg) {
    err=document.createElement("P")
    err.innerText=msg;
    errorArea.appendChild(err);
    errorArea.style.animationPlayState="running";
}
function errorSlideEnd(e) {
    errorArea.removeChild(errorArea.children[0]);
    if(errorArea.childElementCount===0) {
        errorArea.style.animationPlayState="paused";
    }
}