#include "Mist.h"
#include "Test.h"
#include <thread>
#include <chrono>
#include "functions.h"

using namespace Nan;
using namespace std;

Mist::Mist(Callback *data, Callback *complete, Callback *error_callback, v8::Local<v8::Object> & options) 
: StreamingWorker(data, complete, error_callback) {
    //cout << "6. Mist constructor.\n";
}

Mist::~Mist() {
}

void
Mist::sendToNode(Message& message) {
    writeToNode(*_progress, message);
}

void
Mist::Execute(const AsyncProgressWorker::ExecutionProgress& progress) {
    this->_progress = &progress;
    run = true;
    //inst = this;

    //printf("Setting instance %p progress: %p\n", this, &progress);

    while ( run ) {
        //cout << "going to read\n";
        Message m = fromNode.read();
        //cout << "Got this: " << m.name << " : " << m.data << " : " << m.msg << " len: " << m.msg_len << "\n";
        //printf("m.data %p\n", &m.data);

        if(m.name == "kill") {
            //cout << "Execute got kill command\n";
            run = false;
            Test::kill();
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

            bool success = injectMessage(type, m.msg, m.msg_len);

            if(success) { 
                //cout << "Success injecting message " << success << "\n";
                break; 
            } else {
                //cout << "Injecting message waiting for my turn. Mist is busy." << success << "\n";
                this_thread::sleep_for(chrono::milliseconds(100));
            }
        }
    };

    //printf("Plugin Execute is returning\n");
}
