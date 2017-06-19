#include "Mist.h"
#include <thread>
#include <chrono>
#include <iostream>
#include "functions.h"

using namespace Nan;
using namespace std;

Mist::Mist(Callback *progress) 
: AsyncProgressWorker(progress), progress(progress) {
    std::cout << "Mist::Mist " << this << "\n";
}

Mist::~Mist() {
    printf("Destroying Mist instance.");
}

void
Mist::sendToNode(Message& message) {
    printf("Mist::sendToNode() %p\n", &toNode);
    //writeToNode(*_progress, message);
    toNode.write(message);
    _progress->Send(reinterpret_cast<const char*> (&toNode), sizeof (toNode));
}

void
Mist::Execute(const AsyncProgressWorker::ExecutionProgress& progress) {
    this->_progress = &progress;
    run = true;

    std::cout << "Mist::Execute " << this << ", ProgressWorker: " << this->_progress << "\n";
    
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

void
Mist::HandleProgressCallback(const char *data, size_t size) {
    HandleScope scope;

    printf("Mist::HandleProgressCallback: drain queue...\n");

    // drain the queue - since we might only get called once for many writes
    std::deque<Message> contents;
    toNode.readAll(contents);

    for (Message & msg : contents) {
        v8::Local<v8::Value> argv[] = {
            New<v8::String>(msg.name.c_str()).ToLocalChecked(),
            Nan::NewBuffer((char*) msg.msg, (uint32_t) msg.msg_len).ToLocalChecked()
        };
        progress->Call(3, argv);
    }
}