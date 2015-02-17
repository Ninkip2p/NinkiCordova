//
//  ECPlugin.m
//  Ninki
//
//  Created by Ninki on 12/23/14.
//
//

#import "ECPlugin.h"

#import "NSMutableData+Bitcoin.h"
#import "StringFunctions.m"
#import <CommonCrypto/CommonHMAC.h>
#import <openssl/ecdsa.h>
#import <openssl/hmac.h>
#import <openssl/obj_mac.h>
#import <openssl/ripemd.h>


@implementation ECPlugin

- (void)cordovaECMult:(CDVInvokedUrlCommand *)command  {
    
    NSString *mpk = [command.arguments objectAtIndex:(0)];
    
    int32_t n = [(NSNumber *)[command.arguments objectAtIndex:1] intValue];
    int32_t l = [(NSNumber *)[command.arguments objectAtIndex:2] intValue];
    
    NSString *result = [self ECMult:mpk,n,l];
    
    CDVPluginResult *pluginResult = [CDVPluginResult
        resultWithStatus:CDVCommandStatus_OK
                                     messageAsString:result];
    
    [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
    
}

- (void)cordovaECMultCached:(CDVInvokedUrlCommand *)command  {
    
    NSString *mpk = [command.arguments objectAtIndex:(0)];
    
    int32_t n = [(NSNumber *)[command.arguments objectAtIndex:1] intValue];
    
    NSString *result = [self ECMultCached:mpk,n];
    
    CDVPluginResult *pluginResult = [CDVPluginResult
                                     resultWithStatus:CDVCommandStatus_OK
                                     messageAsString:result];
    
    [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
    
}

- (void)cordovaECDerKey:(CDVInvokedUrlCommand *)command  {
    
    NSString *mpk = [command.arguments objectAtIndex:(0)];
    
    int32_t n = [(NSNumber *)[command.arguments objectAtIndex:1] intValue];
    int32_t l = [(NSNumber *)[command.arguments objectAtIndex:2] intValue];
    
    NSString *result = [self ECDerKey:mpk,n,l];
    
    CDVPluginResult *pluginResult = [CDVPluginResult
                                     resultWithStatus:CDVCommandStatus_OK
                                     messageAsString:result];
    
    [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
    
}

- (void)cordovaDerMPK:(CDVInvokedUrlCommand *)command  {
    
    NSString *mpk = [command.arguments objectAtIndex:(0)];
    
    int32_t n = [(NSNumber *)[command.arguments objectAtIndex:1] intValue];
    
    NSString *result = [self ECDerMPK:mpk,n];
    
    CDVPluginResult *pluginResult = [CDVPluginResult
                                     resultWithStatus:CDVCommandStatus_OK
                                     messageAsString:result];
    
    [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
    
}

+ (NSMutableData *)dataFromHexString:(NSString *)string
{
    
    if (string.length % 2) return nil;
    
    NSMutableData *d = [NSMutableData secureDataWithCapacity:string.length/2];
    uint8_t b = 0;
    
    for (NSUInteger i = 0; i < string.length; i++) {
        unichar c = [string characterAtIndex:i];
        
        switch (c) {
            case '0': case '1': case '2': case '3': case '4': case '5': case '6': case '7': case '8': case '9':
            b += c - '0';
            break;
            case 'A': case 'B': case 'C': case 'D': case 'E': case 'F':
            b += c + 10 - 'A';
            break;
            case 'a': case 'b': case 'c': case 'd': case 'e': case 'f':
            b += c + 10 - 'a';
            break;
            default:
            return d;
        }
        
        if (i % 2) {
            [d appendBytes:&b length:1];
            b = 0;
        }
        else b *= 16;
    }
    
    return d;

}

static void CKDPrime(NSMutableData *K, NSMutableData *c, uint32_t i) {
    
    
    BN_CTX *ctx = BN_CTX_new();
    BN_CTX_start(ctx);
    
    
    NSMutableData *I = [NSMutableData secureDataWithLength:CC_SHA512_DIGEST_LENGTH];
    NSMutableData *data = [NSMutableData secureDataWithData:K];
    uint8_t form = POINT_CONVERSION_COMPRESSED;
    BIGNUM *Ilbn = BN_CTX_get(ctx);
    EC_GROUP *group = EC_GROUP_new_by_curve_name(NID_secp256k1);
    EC_POINT *pubKeyPoint = EC_POINT_new(group), *IlPoint = EC_POINT_new(group);
    
    i = CFSwapInt32HostToBig(i);
    [data appendBytes:&i length:sizeof(i)];
    
    
    CCHmac(kCCHmacAlgSHA512, c.bytes, c.length, data.bytes, data.length, I.mutableBytes);
    
    BN_bin2bn(I.bytes, 32, Ilbn);
    EC_GROUP_set_point_conversion_form(group, form);
    EC_POINT_oct2point(group, pubKeyPoint, K.bytes, K.length, ctx);
    
    EC_POINT_mul(group, IlPoint, Ilbn, NULL, NULL, ctx);
    EC_POINT_add(group, pubKeyPoint, IlPoint, pubKeyPoint, ctx);
    
    K.length = EC_POINT_point2oct(group, pubKeyPoint, form, NULL, 0, ctx);
    EC_POINT_point2oct(group, pubKeyPoint, form, K.mutableBytes, K.length, ctx);
    
    [c replaceBytesInRange:NSMakeRange(0, c.length) withBytes:(const unsigned char *)I.bytes + 32 length:32];
    
    EC_POINT_clear_free(IlPoint);
    EC_POINT_clear_free(pubKeyPoint);
    EC_GROUP_free(group);
    BN_CTX_end(ctx);
    BN_CTX_free(ctx);

    
}

static void DPub(NSMutableData *secret, NSMutableData *pubKey) {
    
    BN_CTX *ctx = BN_CTX_new();
    
    if (! ctx) return;
    BN_CTX_start(ctx);
    
    BIGNUM *priv = BN_CTX_get(ctx);
    EC_GROUP *group = EC_GROUP_new_by_curve_name(NID_secp256k1);
    EC_POINT *pub = EC_POINT_new(group);
    
    BN_bin2bn(secret.bytes, 32, priv);
        
    EC_POINT_mul(group, pub, priv, NULL, NULL, ctx);
    
    pubKey.length = EC_POINT_point2oct(group, pub, POINT_CONVERSION_COMPRESSED, NULL, 0, ctx);
    EC_POINT_point2oct(group, pub, POINT_CONVERSION_COMPRESSED, pubKey.mutableBytes, pubKey.length, ctx);
 
    EC_POINT_free(pub);
    
    BN_CTX_end(ctx);
    BN_CTX_free(ctx);
    
}

static void CKD(NSMutableData *k, NSMutableData *c, uint32_t i)
{
    BN_CTX *ctx = BN_CTX_new();
    
    BN_CTX_start(ctx);
    
    NSMutableData *I = [NSMutableData secureDataWithLength:CC_SHA512_DIGEST_LENGTH];
    NSMutableData *data = [NSMutableData secureDataWithCapacity:33 + sizeof(i)];
    BIGNUM *order = BN_CTX_get(ctx), *Ilbn = BN_CTX_get(ctx), *kbn = BN_CTX_get(ctx);
    EC_GROUP *group = EC_GROUP_new_by_curve_name(NID_secp256k1);
    
    
    DPub(k,data);
    
    
    i = CFSwapInt32HostToBig(i);
    [data appendBytes:&i length:sizeof(i)];
    
 
    
    CCHmac(kCCHmacAlgSHA512, c.bytes, c.length, data.bytes, data.length, I.mutableBytes);
    
    BN_bin2bn(I.bytes, 32, Ilbn);
    BN_bin2bn(k.bytes, (int)k.length, kbn);
    EC_GROUP_get_order(group, order, ctx);
    
    BN_mod_add(kbn, Ilbn, kbn, order, ctx);
    
    k.length = 32;
    [k resetBytesInRange:NSMakeRange(0, 32)];
    BN_bn2bin(kbn, (unsigned char *)k.mutableBytes + 32 - BN_num_bytes(kbn));
    [c replaceBytesInRange:NSMakeRange(0, c.length) withBytes:(const unsigned char *)I.bytes + 32 length:32];
    
    EC_GROUP_free(group);
    BN_CTX_end(ctx);
    BN_CTX_free(ctx);
}

- (NSString *)ECMult:(NSString *)mpk,uint32_t n,uint32_t l{
    
    //get a hex representation of the public key and chain code
    
    NSData *masterPublicKey = mpk.base58ToData;
    
    
    NSMutableData *chain = [NSMutableData secureDataWithCapacity:32];
    NSMutableData *pubKey = [NSMutableData secureDataWithCapacity:65];
    
    [chain appendBytes:(const unsigned char *)masterPublicKey.bytes + 13 length:32];
    [pubKey appendBytes:(const unsigned char *)masterPublicKey.bytes + 45 length:33];
    
    
    CKDPrime(pubKey, chain, 0);
    
    
    CKDPrime(pubKey, chain, n); // internal or external chain
    
    
    CKDPrime(pubKey, chain, l); // nth key in chain
    
    //get a test mpk as hex
    //convert hex to nsdata
    
    NSString *outStrg = pubKey.hexadecimalString;
    
    return [outStrg copy];
    
}


- (NSString *) ECDerKey:(NSString *)pk,uint32_t n,uint32_t l{


    NSMutableData *I = [NSMutableData secureDataWithLength:CC_SHA512_DIGEST_LENGTH];
    NSMutableData *secret = [NSMutableData secureDataWithCapacity:32];
    NSMutableData *chain = [NSMutableData secureDataWithCapacity:32];
    uint8_t version = BITCOIN_PRIVKEY;
    
#if BITCOIN_TESTNET
    version = BITCOIN_PRIVKEY_TEST;
#endif
    
    
    NSData *masterPrivKey = pk.base58ToData;
    
    [secret appendBytes:(const unsigned char *)masterPrivKey.bytes + 46 length:32];
    [chain appendBytes:(const unsigned char *)masterPrivKey.bytes + 13 length:32];
    
    
    CKD(secret, chain, 0);
    
    CKD(secret, chain, n);
  
    NSMutableData *prvKey = [NSMutableData secureDataWithCapacity:32];
    NSMutableData *s = [NSMutableData secureDataWithData:secret];
    NSMutableData *c = [NSMutableData secureDataWithData:chain];
    
    CKD(s, c, l);
    
    [prvKey appendData:s];
    
    NSString *outStrg = prvKey.hexadecimalString;
    
    return [outStrg copy];
    
}

- (NSString *) ECMultCached:(NSString *)mpk,uint32_t n
    {
    
    //get a hex representation of the public key and chain code
    
    NSData *masterPublicKey = mpk.base58ToData;
    
    NSMutableData *chain = [NSMutableData secureDataWithCapacity:32];
    NSMutableData *pubKey = [NSMutableData secureDataWithCapacity:65];
    
    [chain appendBytes:(const unsigned char *)masterPublicKey.bytes + 13 length:32];
    [pubKey appendBytes:(const unsigned char *)masterPublicKey.bytes + 45 length:33];
    
    CKDPrime(pubKey, chain, n);
    
    //get a test mpk as hex
    //convert hex to nsdata
    
    NSString *outStrg = pubKey.hexadecimalString;
    //NSString *outStrg2 = c.hexadecimalString;
    
    //NSString *message = [outStrg stringByAppendingString:outStrg2];
    
    return [outStrg copy];
    
}

- (NSString *) ECDerMPK:(NSString *)mpk,uint32_t n
{
    
    //get a hex representation of the public key and chain code
    
    NSData *masterPublicKey = mpk.base58ToData;
    
    NSMutableData *chain = [NSMutableData secureDataWithCapacity:32];
    NSMutableData *pubKey = [NSMutableData secureDataWithCapacity:33];
    
    
    [chain appendBytes:(const unsigned char *)masterPublicKey.bytes + 13 length:32];
    [pubKey appendBytes:(const unsigned char *)masterPublicKey.bytes + 45 length:33];
    
    
    CKDPrime(pubKey, chain, 0);
    
    NSMutableData *hpub = [NSMutableData secureDataWithLength:CC_SHA256_DIGEST_LENGTH];
    NSMutableData *hrpub = [NSMutableData secureDataWithLength:RIPEMD160_DIGEST_LENGTH];
    
    
    CC_SHA256(pubKey.bytes, pubKey.length, hpub.mutableBytes);
    

    simpleRIPEMD160(hpub.bytes, hpub.length, hrpub.mutableBytes);
    

    NSMutableData *fingerprint = [NSMutableData secureDataWithCapacity:4];
    [fingerprint appendBytes:(const unsigned char *)hrpub.bytes length:4];
    //now we need the first 4 byte of this for the fingerprint
    
    
    CKDPrime(pubKey, chain, n);
    
    NSMutableData *d = [NSMutableData secureDataWithCapacity:14 + pubKey.length + chain.length];
    
//#if BITCOIN_TESTNET
    [d appendBytes:"\x04\x35\x87\xCF" length:4];
//#else
//    [d appendBytes:"\x04\x88\xB2\x1E" length:4];
//#endif
    
    uint32_t f = CFSwapInt32HostToBig((uint32_t)fingerprint);
    n = CFSwapInt32HostToBig(n);
    


    [d appendBytes:"\x02" length:1];
    [d appendData:fingerprint];
    [d appendBytes:&n length:sizeof(n)];
    [d appendData:chain];
    
    if (pubKey.length < 33) [d appendBytes:"\0" length:1];
    [d appendData:pubKey];
    
    NSString *outStrg = d.hexadecimalString;
   
    return [outStrg copy];
    
}

bool simpleRIPEMD160(void* input, unsigned long length, unsigned char* md)
{
    RIPEMD160_CTX context;
    if(!RIPEMD160_Init(&context))
        return false;
    
    if(!RIPEMD160_Update(&context, (unsigned char*)input, length))
        return false;
    
    if(!RIPEMD160_Final(md, &context))
        return false;
    
    return true;
}

@end

