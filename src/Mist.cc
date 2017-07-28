#include "Mist.h"
#include <thread>
#include <chrono>
#include <iostream>
#include "functions.h"
#include "bson_visit.h"
#include "MistWrapper.h"

using namespace Nan;
using namespace std;

Mist::Mist(Callback *progress) 
: AsyncProgressWorker(progress), progress(progress) {
    //std::cout << "Mist::Mist " << this << "\n";
    _progress = NULL;
    mistWrapper = NULL;
}

Mist::~Mist() {
    //printf("Destroying Mist instance. Signaling to MistWrapper %p\n", mistWrapper);
    if (mistWrapper != NULL) {
        mistWrapper->mistDeleted();
    }
}

void
Mist::setWrapper(MistWrapper* wrapper) {
    mistWrapper = wrapper;
}

void
Mist::sendToNode(Message& message) {
    //printf("Mist::sendToNode() %p _progress: %p\n", &toNode, _progress);
    
    if (_progress == NULL) {
        printf("Mist::sendToNode before or after addon Mist::Execute has been run!!?!\n");
        //bson_visit("pre- or postmature  sendToNode", message.msg);
        return;
    }
    
    toNode.write(message);
    _progress->Send(reinterpret_cast<const char*> (&toNode), sizeof (toNode));
}

void
Mist::Execute(const AsyncProgressWorker::ExecutionProgress& progress) {
    _progress = &progress;
    run = true;

    //std::cout << "Mist::Execute " << this << ", ProgressWorker: " << this->_progress << "\n";
    
    while ( run ) {
        Message m = fromNode.read();

        while (true) {
            int type = 0;
            if (m.name == "kill") {
                //printf("AsyncProgressWorker got the kill signal, waiting for the last injection to be successful.\n");
                run = false;
                _progress = NULL;
                type = 0;
            } else if ( m.name == "wish") {
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
                //printf("Injecting message waiting for my turn. Mist is busy.\n");
                this_thread::sleep_for(chrono::milliseconds(50));
            }
        }
    };

    //printf("Plugin Execute is returning.\n");
}

void
Mist::HandleProgressCallback(const char *data, size_t size) {
    HandleScope scope;

    //printf("Mist::HandleProgressCallback: drain queue...\n");

    // drain the queue - since we might only get called once for many writes
    std::deque<Message> contents;
    toNode.readAll(contents);

    for (Message & msg : contents) {
        v8::Local<v8::Value> argv[] = {
            New<v8::String>(msg.name.c_str()).ToLocalChecked(),
            Nan::NewBuffer((char*) msg.msg, (uint32_t) msg.msg_len).ToLocalChecked()
        };
        
        // TODO: Should catch exception from javascript?
        progress->Call(3, argv);
    }
}