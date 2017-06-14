#include "Mist.h"
#include <thread>
#include <chrono>
#include <iostream>
#include "functions.h"

using namespace Nan;
using namespace std;

Mist::Mist(Callback *data) 
: StreamingWorker(data) {
    std::cout << "Mist::Mist " << this << "\n";
}

Mist::~Mist() {
    printf("Destroying Mist instance.");
}

void
Mist::sendToNode(Message& message) {
    //printf("Mist::sendToNode()\n");
    writeToNode(*_progress, message);
}

void
Mist::Execute(const AsyncProgressWorker::ExecutionProgress& progress) {
    this->_progress = &progress;
    run = true;

    std::cout << "Mist::Execute " << this << "\n";
    
    while ( run ) {
        Message m = fromNode.read();

        if(m.name == "kill") {
            // Execute got kill command
            run = false;
            //Message msg("done", "", NULL, 0);
            //writeToNode(progress, msg);            
        }

        while (true) {
            int type = 0;
            if (m.name == "wish") {
                type = 1;
            } else if ( m.name == "mist") {
                type = 2;
            } else if ( m.name == "mistnode") {
                type = 3;
            } else if ( m.name == "sandboxed") {
                type = 4;
            }

            bool success = injectMessage(this, type, m.msg, m.msg_len);

            if(success) { 
                //printf("Success injecting message\n");
                break; 
            } else {
                printf("Injecting message waiting for my turn. Mist is busy.\n");
                this_thread::sleep_for(chrono::milliseconds(50));
                //Message msg("fun", "sun", NULL, 0);
                //writeToNode(progress, msg);
            }
        }
    };

    //printf("Plugin Execute is returning\n");
}
