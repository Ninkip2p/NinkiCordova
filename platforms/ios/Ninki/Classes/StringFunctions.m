//
//  StringFunctions.m
//  Ninki
//
//  Created by Ninki on 12/26/14.
//
//

#import <Foundation/Foundation.h>
#import "CommonCrypto/ccMemory.h"
#import <openssl/ecdsa.h>
#import "NSMutableData+Bitcoin.h"

@interface NSString (NSStringHexToBytes)
-(NSMutableData*) hexToBytes ;
- (NSData *)base58ToData;
+ (NSString *)base58checkWithData:(NSData *)d;
@end



@implementation NSString (NSStringHexToBytes)

static const char base58chars[] = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

-(NSMutableData*) hexToBytes {
    const char *chars = [self UTF8String];
    int i = 0, len = self.length;
    
    NSMutableData *data = [NSMutableData dataWithCapacity:len / 2];
    char byteChars[3] = {'\0','\0','\0'};
    unsigned long wholeByte;
    
    while (i < len) {
        byteChars[0] = chars[i++];
        byteChars[1] = chars[i++];
        wholeByte = strtoul(byteChars, NULL, 16);
        [data appendBytes:&wholeByte length:1];
    }
    
    return data;
}

- (NSData *)base58ToData
{
    BN_CTX *ctx = BN_CTX_new();
    
    BN_CTX_start(ctx);
    
    NSMutableData *d = [NSMutableData secureDataWithCapacity:self.length + 1];
    unsigned int b;
    BIGNUM *base = BN_CTX_get(ctx), *x = BN_CTX_get(ctx), *y = BN_CTX_get(ctx);
    
    BN_set_word(base, 58);
    BN_zero(x);
    
    for (NSUInteger i = 0; i < self.length && [self characterAtIndex:i] == base58chars[0]; i++) {
        [d appendBytes:"\0" length:1];
    }
    
    for (NSUInteger i = 0; i < self.length; i++) {
        b = [self characterAtIndex:i];
        
        switch (b) {
            case '1': case '2': case '3': case '4': case '5': case '6': case '7': case '8': case '9':
            b -= '1';
            break;
            case 'A': case 'B': case 'C': case 'D': case 'E': case 'F': case 'G': case 'H':
            b += 9 - 'A';
            break;
            case 'J': case 'K': case 'L': case 'M': case 'N':
            b += 17 - 'J';
            break;
            case 'P': case 'Q': case 'R': case 'S': case 'T': case 'U': case 'V': case 'W': case 'X': case 'Y':
            case 'Z':
            b += 22 - 'P';
            break;
            case 'a': case 'b': case 'c': case 'd': case 'e': case 'f': case 'g': case 'h': case 'i': case 'j':
            case 'k':
            b += 33 - 'a';
            break;
            case 'm': case 'n': case 'o': case 'p': case 'q': case 'r': case 's': case 't': case 'u': case 'v':
            case 'w': case 'x': case 'y': case 'z':
            b += 44 - 'm';
            break;
            case ' ':
            continue;
            default:
            goto breakout;
        }
        
        BN_mul(x, x, base, ctx);
        BN_set_word(y, b);
        BN_add(x, x, y);
    }
    
breakout:
    d.length += BN_num_bytes(x);
    BN_bn2bin(x, (unsigned char *)d.mutableBytes + d.length - BN_num_bytes(x));
    
    CC_XZEROMEM(&b, sizeof(b));
    BN_CTX_end(ctx);
    BN_CTX_free(ctx);
    
    return d;
}


@end

/** Converts NSData to a hexadecimal string. */
@interface NSData (NSData_hexadecimalString)
/** Changes NSData object to a hex string.
 @returns hexadecimal string of NSData. Empty string if data is empty.*/
- (NSString *)hexadecimalString;

// String in Base58 without checksum
- (NSString*) base58;

// String in Base58 with checksum
- (NSString*) base58Check;

@end



@implementation NSData (NSData_hexadecimalString)

- (NSString *)hexadecimalString {
    const unsigned char *dataBuffer = (const unsigned char *)[self bytes];
    if (!dataBuffer) return [NSString string];
    
    NSUInteger          dataLength  = [self length];
    NSMutableString     *hexString  = [NSMutableString stringWithCapacity:(dataLength * 2)];
    
    for (int i = 0; i < dataLength; ++i)
    [hexString appendString:[NSString stringWithFormat:@"%02lx", (unsigned long)dataBuffer[i]]];
    
    return [NSString stringWithString:hexString];
}


@end







