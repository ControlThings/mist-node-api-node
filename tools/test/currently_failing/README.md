# Currently failing tests

## multi-mist.js

This test fails because of a suspected concurrency issue in
wish_core_client. See mist-c99 branch core-client-concurrency for a fix
that illustrates one apparent problem, but does not actually fix the
problems.

## mist-api-sandbox-commission.js

The test fails because of an incorrectly set timebase in node.js
version. The commission_periodic call should be called with 1-second
intervals, but the node.js system calls it with 20 us intervals.

## mist-api-sandbox-friend-request.js

This test is a bit of a puzzle. For some reason, the test fails over 90%
ot times, because the remote 'signals' request from the sandbox gets
cleaned up, because the underlying connection between cores 
is closed for some reason, before the system sends the friend request.



