//
//  ECPlugin.h
//  Ninki
//
//  Created by Ninki on 12/23/14.
//
//

#import <Cordova/CDVPlugin.h>

@interface ECPlugin : CDVPlugin

- (void) cordovaECMult:(CDVInvokedUrlCommand *)command;
- (void)cordovaECMultCached:(CDVInvokedUrlCommand *)command;
#pragma mark - Util_Methods

- (NSString *) ECMult:(NSString*)mpk,uint32_t n,uint32_t l;
- (NSString *) ECMultCached:(NSString *)mpk,uint32_t n;
- (NSString *) ECDerKey:(NSString *)pk,uint32_t n,uint32_t l;
- (NSString *) ECDerMPK:(NSString *)pk,uint32_t n;
+ (NSMutableData *)dataFromHexString:(NSString *)string;

@end
