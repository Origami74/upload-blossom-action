import {getInput, setFailed, setOutput} from "@actions/core"
import {readFileSync} from 'fs';
import {NDKPrivateKeySigner, NostrEvent} from "@nostr-dev-kit/ndk";
import {BlossomClient, EventTemplate, SignedEvent} from "blossom-client-sdk";
import mime from "mime";

console.log('Starting blossom Upload');

async function upload(privateKey: string, filePath: string, host: string): Promise<void> {
    const data = readFileSync(filePath);

    const fileType = mime.getType(filePath);
    const blob = new Blob([data], {type: fileType?.toString()});

    async function signer(event: EventTemplate): Promise<SignedEvent> {
        let signer;
        if(privateKey){
            signer = new NDKPrivateKeySigner(privateKey);
        } else {
            signer = NDKPrivateKeySigner.generate();
        }
        const pubkey = await signer.user().then(u => u.pubkey)

        const signature =  await signer.sign(event as NostrEvent);

        const y = event as NostrEvent
        return {...event, pubkey: pubkey, sig: signature, id: y.id!};
    }

    const client = new BlossomClient(host, signer);

    const uploadAuthEvent = await client.createUploadAuth(blob, 'Upload file')
    const result = await client.uploadBlob(blob, {auth: uploadAuthEvent})

    setOutput("url", result.url);
    console.log(`Blob uploaded!, ${result.url}`);
}

try {
    // Fetch the value of the input 'who-to-greet' specified in action.yml
    const host = getInput('host');
    const filePath = getInput('filePath');
    const privatekey = getInput('privatekey');

    console.log(`Uploading file '${filePath}' to host: '${host}'!`);

    upload(privatekey, filePath, host)
        .then(blossomHash => {
            setOutput("hash", blossomHash);
        })
        .catch((error) => {
            console.error("Blossom Upload failed with error", error);

            if(error instanceof Error) {
                setFailed(error.message);
            } else{
                setFailed("unexpected error");
            }
        })

} catch (error) {
    console.error("Blossom Upload failed with error", error);

    if(error instanceof Error) {
        setFailed(error.message);
    } else{
        setFailed("unexpected error");
    }
}