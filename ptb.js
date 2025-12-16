/*
 * V 1.8.3
 *
MIT License

Copyright (c) 2013-2024 Physikalisch-Technische Bundesanstalt
              2025 Kai Harries

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
 *
 */

var ptbDelta, // Delta between system clock and ptb clock in milliseconds
    ptbUncertainty; // Uncertainty of the ptb clock in milliseconds (incl. network latency)

// Wrap in anonymous function for data encapsulation
(function () {

    var wsock, // websocket
        ppActiv = false, // pingpong ongoing
        ppTimeout, // time between pingpongs
        rcTimeout, // time between reconnects
        ad = Array();

    /**
     * Get the difference between the PTB clock and our system clock.
     *
     * @param {number} timeDelta - The delta between our high resolution timestamp and the PTB clock
     * @returns {number} The offset of our system clock (compared to the PTB clock).
     */
    function timeDiff(timeDelta) {
        var ptb = new Date(performance.now() + timeDelta),
            system = new Date();
        return system.getTime() - ptb.getTime();
    }

    function connectWebSocket () {
        wsock = new WebSocket('wss://uhr.ptb.de/time','time');
        wsock.onmessage=function(evnt) {
            // The evnt.data contains the following fields:
            //   s: UTC time of the PTB server
            //   e: the uncertainty of the server
            //   c: our high resolution timestamp from the request
            var sdata=JSON.parse(evnt.data);
            // console.log(`evnt.data: ${evnt.data}`);
            // Calculate difference in ms between returned server time an performance.now();
            var now = performance.now(),
                dtReply = (now - sdata.c) / 2, // 1/2 of roundtrip to server; estimate, that both directions are equal fast
                tmDlt = sdata.s + dtReply - now; // how many milliseconds is the PTB UTC clock away from performance.now()
            ad.push([tmDlt, dtReply+sdata.e]);
            if (ad.length>5) {
                ad.shift();
            }
            ad.sort(function(a,b){return a[1]-b[1];}); // sort by uncertainty
            // console.log(`# ${ad.length}: tmDlt: ${ad[0][0]}, uncertainty: ${ad[0][1]}`);
            if (ad.length<5) {
                wsock.send(JSON.stringify({c: performance.now()}));
            }
            else {
                ppActiv=false;
                ppTimeout=setTimeout(function() {
                    if (wsock.readyState===wsock.OPEN) {
                        ad=Array();
                        ppActiv=true;
                        console.log('Time request start. reason: redo');
                        wsock.send(JSON.stringify({c: performance.now()}));
                    }
                }, 60000);
            }
            window.ptbDelta = timeDiff(ad[0][0]);
            window.ptbUncertainty = Math.round(ad[0][1]);
            const msg = `Δ ${window.ptbDelta} ms ± ${window.ptbUncertainty} ms`;
            updateHtml(msg);
            // console.log(msg);
        };
        wsock.onopen=function() {
            if (!ppActiv) {
                clearTimeout(ppTimeout);
                clearTimeout(rcTimeout);
                checkWS.init();
                ad=Array();
                ppActiv=true;
                console.log('Time request start. reason: onopen websocket');
                wsock.send(JSON.stringify({c: performance.now()}));
            }
        };
        wsock.onclose=function () {
            clearTimeout(ppTimeout);
            rcTimeout=setTimeout(checkWS, checkWS.wait);
        };
        wsock.onerror=function () {
            ppActiv=false;
            rcTimeout=setTimeout(checkWS, checkWS.wait);
        };
    }

    function checkWS(e) {
        if(!wsock || wsock.readyState === 3) {
            console.log('try reconnect', checkWS.wait);
            connectWebSocket();
            if (!e && checkWS.wait<120000) {
                checkWS.wait*=1.3;
            }
        }
    }

    checkWS.init=function() {
        checkWS.wait=Math.random()*1000+1000;
    };   // initial wait between 1 and 2 secondes
    checkWS.init();

    checkWS();

    window.onfocus=function(e) {
        checkWS(e);
    };

    function updateHtml(text) {
        document.getElementById("ptbOffset").textContent = text;
    }

})();
