"use client";
import React, { useEffect, useRef, useState } from "react";

const VideoCall = () => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const ws = useRef<WebSocket | null>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);

  useEffect(() => {
    ws.current = new WebSocket("ws://localhost:5000");

    ws.current.onopen = () => {
      console.log("Connected to WebSocket server");
      ws.current?.send(JSON.stringify({ type: "find_match" }));
    };

    ws.current.onmessage = async (message) => {
      const data = JSON.parse(message.data);

      if (data.type === "match_found") {
        console.log("Match found, setting up connection...");
        setupWebRTC();
        setIsConnected(true);
      } else if (data.type === "offer") {
        if (!peerConnection.current) setupWebRTC();
        await peerConnection.current?.setRemoteDescription(
          new RTCSessionDescription(data.offer)
        );
        const answer = await peerConnection.current?.createAnswer();
        await peerConnection.current?.setLocalDescription(answer);
        ws.current?.send(JSON.stringify({ type: "answer", answer }));
      } else if (data.type === "answer") {
        await peerConnection.current?.setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );
      } else if (data.type === "ice-candidate") {
        await peerConnection.current?.addIceCandidate(
          new RTCIceCandidate(data.candidate)
        );
      } else if (data.type === "user_disconnected") {
        setIsConnected(false);
      }
    };

    return () => {
      ws.current?.close();
    };
  }, []);

  const setupWebRTC = () => {
    peerConnection.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        ws.current?.send(
          JSON.stringify({ type: "ice-candidate", candidate: event.candidate })
        );
      }
    };

    peerConnection.current.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        stream
          .getTracks()
          .forEach((track) => peerConnection.current?.addTrack(track, stream));
      });
  };

  const startCall = async () => {
    if (!peerConnection.current) setupWebRTC();
    const offer = await peerConnection.current?.createOffer();
    await peerConnection.current?.setLocalDescription(offer);
    ws.current?.send(JSON.stringify({ type: "offer", offer }));
  };

  const toggleCamera = () => {
    const stream = localVideoRef.current?.srcObject as MediaStream | null;
    const videoTrack = stream
      ?.getTracks()
      .find((track) => track.kind === "video");

    //   .find((track) => track.kind === "video");
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsCameraOn(videoTrack.enabled);
    }
  };

  const toggleMicrophone = () => {
    const stream = localVideoRef.current?.srcObject as MediaStream | null;
    const audioTrack = stream
      ?.getTracks()
      .find((track) => track.kind === "audio");

    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMicOn(audioTrack.enabled);
    }
  };

  return (
    <div className="h-screen flex flex-col items-center bg-gray-900 text-white p-4">
      <h1 className="text-2xl font-bold mb-4">Talk2Strangers - Video Call</h1>

      <div className="flex w-full max-w-4xl h-[70vh] border-2 border-gray-700 rounded-lg overflow-hidden">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-1/2 h-full bg-black"
        ></video>
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-1/2 h-full bg-black"
        ></video>
      </div>

      {!isConnected && (
        <p className="mt-4 text-yellow-300">Waiting for another user...</p>
      )}

      <div className="mt-4 flex space-x-4">
        <button
          onClick={startCall}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-700 rounded"
        >
          Start Call
        </button>
        <button
          onClick={toggleCamera}
          className="px-4 py-2 bg-green-500 hover:bg-green-700 rounded"
        >
          {isCameraOn ? "Turn Camera Off" : "Turn Camera On"}
        </button>
        <button
          onClick={toggleMicrophone}
          className="px-4 py-2 bg-red-500 hover:bg-red-700 rounded"
        >
          {isMicOn ? "Mute Mic" : "Unmute Mic"}
        </button>
      </div>
    </div>
  );
};

export default VideoCall;
