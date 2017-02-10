#include <iostream>
#include <string>
#include <algorithm>
#include <iterator>
#include <thread>
#include <chrono>
#include <nan.h>
#include <node.h>
#include <iostream>
#include <thread>

#include <cstdio>

#include <stdlib.h>
#include <string.h>

#include "NativeExtension.h"
#include "StreamingWorker.h"
#include "StreamingWorkerWrapper.h"
#include "PCQueue.h"
#include "Message.h"
#include "functions.h"

using v8::FunctionTemplate;

using namespace Nan;
using namespace std;

static void* inst;

class EvenOdd : public StreamingWorker {
public:

    EvenOdd(Callback *data, Callback *complete, Callback *error_callback, v8::Local<v8::Object> & options) 
            : StreamingWorker(data, complete, error_callback) {
        //cout << "6. EvenOdd constructor.\n";
    }

    ~EvenOdd() {
    }
    
    void sendToNode(Message& message) {
        writeToNode(*_progress, message);
    }

    void Execute(const AsyncProgressWorker::ExecutionProgress& progress) {
        this->_progress = &progress;
        run = true;
        inst = this;
        
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
                    std::this_thread::sleep_for(chrono::milliseconds(100));
                }
            }
        };
        
        //printf("Plugin Execute is returning\n");
    }
private:
    bool run;
    const AsyncProgressWorker::ExecutionProgress* _progress;
};

void Test::send(uint8_t* buf, int len) {
    //printf("sending sending... %p buf: %p len: %i\n", inst, buf, len);
    EvenOdd* e = (EvenOdd*) inst;

    string a = "even";
    string b = "dummy";
    
    Message msg(a, b, (uint8_t*) buf, len);
    
    e->sendToNode(msg);
}

void Test::sendSandboxed(uint8_t* buf, int len) {
    //printf("sending sending... %p buf: %p len: %i\n", inst, buf, len);
    EvenOdd* e = (EvenOdd*) inst;

    string a = "sandboxed";
    string b = "dummy";
    
    Message msg(a, b, (uint8_t*) buf, len);
    
    e->sendToNode(msg);
}

void Test::write(uint8_t* buf, int len) {
    //printf("sending sending... %p buf: %p len: %i\n", inst, buf, len);
    EvenOdd* e = (EvenOdd*) inst;

    string a = "write";
    string b = "dummy";
    
    Message msg(a, b, (uint8_t*) buf, len);
    
    e->sendToNode(msg);
}

void Test::invoke(uint8_t* buf, int len) {
    //printf("sending sending... %p buf: %p len: %i\n", inst, buf, len);
    EvenOdd* e = (EvenOdd*) inst;

    string a = "invoke";
    string b = "dummy";
    
    Message msg(a, b, (uint8_t*) buf, len);
    
    e->sendToNode(msg);
}

void Test::kill() {
    //printf("kill kill..\n");
    EvenOdd* e = (EvenOdd*) inst;

    string a = "done";
    string b = "dummy";
    
    Message msg(a, b, NULL, 0);
    
    e->sendToNode(msg);
}

StreamingWorker * create_worker(Callback *data, Callback *complete, Callback *error_callback, v8::Local<v8::Object> & options) {
    return new EvenOdd(data, complete, error_callback, options);
}

NODE_MODULE(MistApi, StreamingWorkerWrapper::Init)
