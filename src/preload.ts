import { OpenAI } from "openai";
//import { TextToSpeechClient } from "@google-cloud/text-to-speech";
//import { google } from "@google-cloud/text-to-speech/build/protos/protos";
import * as WavEncoder from "wav-encoder";
import { AudioConfig, ResultReason, SpeechConfig, SpeechRecognizer, SpeechSynthesizer } from "microsoft-cognitiveservices-speech-sdk";
import * as path from "path";
//import * as fs from "fs";
//import * as util from "util";
//import * as readline from "readline";

window.addEventListener("DOMContentLoaded", () => {

  require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

  const speechConfig = SpeechConfig.fromSubscription(process.env.SPEECH_KEY, process.env.SPEECH_REGION);
  speechConfig.speechRecognitionLanguage = "es-DO";

  speechConfig.speechSynthesisVoiceName = "es-DO-RamonaNeural";

  const openaiApi = new OpenAI({
    apiKey: process.env.OPENAI_KEY,
    dangerouslyAllowBrowser: true,
  });

  //const gtts = new TextToSpeechClient();

  let rec: MediaRecorder | null = null;
  let audioStream: MediaStream | null = null;

  const recordButton = document.getElementById("recordButton") as HTMLButtonElement;
  const transcribeButton = document.getElementById("transcribeButton") as HTMLButtonElement;

  recordButton.addEventListener("click", startRecording);
  transcribeButton.addEventListener("click", transcribeText);

  function startRecording() {
    const constraints: MediaStreamConstraints = { audio: true, video: false };

    recordButton.disabled = true;
    transcribeButton.disabled = false;

    navigator.mediaDevices.getUserMedia(constraints)
      .then(function (stream) {
        //const audioContext = new AudioContext();
        audioStream = stream;
        //const input = audioContext.createMediaStreamSource(stream);
        rec = new MediaRecorder(stream);
        rec.start();

        document.getElementById("output").innerHTML = "Recording started...";
      })
      .catch(function (err) {
        recordButton.disabled = false;
        transcribeButton.disabled = true;
      });
  }

  function transcribeText() {
    document.getElementById("output").innerHTML = "Converting audio to text...";
    transcribeButton.disabled = true;
    recordButton.disabled = false;

    if (rec) {
      rec.stop();
    }

    if (audioStream) {
      const audioTrack = audioStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.stop();
      }
    }

    if (rec) {
      rec.ondataavailable = (event) => {
        const blob = new Blob([event.data], { type: "audio/wav" });
        uploadSoundData(blob);
      };
    }
  }

  function uploadSoundData(blob: Blob) {
    transcript(blob);
  }

   async function transcript(blob: Blob) {

    let transcript = await transcriptSpeech(blob);
    let text = await answerQuestion(transcript);
    createSpeech(text);

  }

  async function transcriptSpeech(blob: Blob) {

    // // Obtén los datos de audio del Blob
    // let arrayBuffer = await blob.arrayBuffer();
    // // Asegurémonos de que la longitud sea múltiplo de 4
    // const dataView = new DataView(arrayBuffer);
    // const originalLength = dataView.byteLength;
    // const padding = 4 - (originalLength % 4);
    // if (padding !== 4) {
    //   const paddedArrayBuffer = new ArrayBuffer(originalLength + padding);
    //   const paddedDataView = new DataView(paddedArrayBuffer);
    //   for (let i = 0; i < originalLength; i++) {
    //     paddedDataView.setUint8(i, dataView.getUint8(i));
    //   }
    //   arrayBuffer = paddedArrayBuffer;
    // }

    // const audioData: WavEncoder.AudioData = {
    //   sampleRate: 44100,
    //   channelData: [new Float32Array(arrayBuffer)],
    // };

    // // Agrega un encabezado WAV
    // let wavData = null;
    // await WavEncoder.encode(audioData).then((buffer) => {
    //   wavData = buffer;
    // });

    // const wavBlob = new Blob([wavData], { type: 'audio/wav' });

    // // Microsoft ---------------------------------------------------------------------------------------------------------------------
    // let audioConfig = AudioConfig.fromWavFileInput(new File([wavBlob], 'audio.wav'));
    // let speechRecognizer = new SpeechRecognizer(speechConfig, audioConfig);

    // //  play2(blob);
    // let transcript = "Hola";

    // await speechRecognizer.recognizeOnceAsync((result) => {
    //   speechRecognizer.close();
    //   console.log(result);
    //   transcript = result.text;
    //   console.log(transcript);

    // }, (err) => {

    //   console.log(err);
    // });

    // document.getElementById("question").innerHTML = transcript;
    // return transcript;

    // OpenAi ------------------------------------------------------------------------------------------------------------------------
    const transcriptG = await openaiApi.audio.transcriptions.create({
      model: 'whisper-1',
      file: new File([blob], 'audio.wav'),
    });

    let transcript = transcriptG.text;
    document.getElementById("question").innerHTML = transcript;
    return transcript;

  }

  async function answerQuestion(transcript: string) {

    // OpenAi ------------------------------------------------------------------------------------------------------------------------
    const completion = await openaiApi.completions.create({
      model: 'gpt-3.5-turbo-instruct',
      prompt: `Que tu respuesta sea breve y corta y evita usar códigos o caracteres ilegibles o iconos, que todas tus respuestas estén orientadas a la navidad y en caso de no poder orientarla a la navidad o un tema relacionado a la navidad, responde con "No puedo responder temas no relacionados con la navidad, pero sí te puedo dar un dato navideño" y procedes a dar un dato sobre la navidad.  "${transcript}"`,
      temperature: 0.7,
      max_tokens: 256,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    document.getElementById("output").innerHTML = completion.choices[0].text;
    return completion.choices[0].text;
  }

  async function createSpeech(text: string) {
    // microsoft ------------------------------------------------------------------------------------------------------------------------
    // Create the speech synthesizer.
    var synthesizer = new SpeechSynthesizer(speechConfig);
    // Start the synthesizer and wait for a result.
    const response: any = synthesizer.speakTextAsync(text,
      function (result) {
        if (result.reason === ResultReason.SynthesizingAudioCompleted) {
          console.log("synthesis finished.");
        } else {
          console.error("Speech synthesis canceled, " + result.errorDetails +
            "\nDid you set the speech resource key and region values?");
        }
        synthesizer.close();
        synthesizer = null;
      },
      function (err) {
        console.trace("err - " + err);
        synthesizer.close();
        synthesizer = null;
      });
    play(response);

    // // Google ------------------------------------------------------------------------------------------------------------------------
    // const request = {
    //   audioConfig: {
    //     audioEncoding: google.cloud.texttospeech.v1.AudioEncoding.MP3,
    //     effectsProfileId: ["headphone-class-device"],
    //     pitch: 0,
    //     speakingRate: 1,
    //   },
    //   input: { text: text },
    //   voice: {
    //     languageCode: "es-US",
    //     name: "es-US-Studio-B",
    //   },
    // };

    // // Performs the text-to-speech request
    // const response: any = await gtts.synthesizeSpeech(request);
    // console.log(response);
    // play(response);

  }
  
  function play(audioContent: Uint8Array) {
    const blob = new Blob([audioContent], { type: 'audio/mp3' });
    const audioUrl = URL.createObjectURL(blob);
    const audio = new Audio(audioUrl);
    audio.play();
  }

  function play2(audioContent: Blob) {
    const audioUrl = URL.createObjectURL(audioContent);
    const audio = new Audio(audioUrl);
    audio.play();
  }

});
