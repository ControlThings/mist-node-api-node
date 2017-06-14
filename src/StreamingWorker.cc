#include "StreamingWorker.h"
#include <iostream>
#include <cstdio>

using namespace Nan;

StreamingWorker::StreamingWorker(Callback *progress)
: AsyncProgressWorker(progress), progress(progress) {
    std::cout << "Streaming worker\n" << this;
    input_closed = false;
}

StreamingWorker::~StreamingWorker() {
    //delete progress;
}

void
StreamingWorker::HandleProgressCallback(const char *data, size_t size) {
    drainQueue();
}

void
StreamingWorker::close() {
    input_closed = true;
}

void
StreamingWorker::writeToNode(const AsyncProgressWorker::ExecutionProgress& progress, Message & msg) {
    toNode.write(msg);
    progress.Send(reinterpret_cast<const char*> (&toNode), sizeof (toNode));
}

bool
StreamingWorker::closed() {
    return input_closed;
}

void
StreamingWorker::drainQueue() {
    HandleScope scope;

    //printf("drain queue...\n");

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

