import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53targets from 'aws-cdk-lib/aws-route53-targets';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { CertificateStack } from './certificate-stack';

interface Route53StackProps extends StackProps {
  alb: elbv2.ApplicationLoadBalancer;
  certificateStack: CertificateStack;
}

export class Route53Stack extends Stack {
  constructor(scope: Construct, id: string, props: Route53StackProps) {
    super(scope, id, props);

    // app.example.com のレコード作成
    new route53.ARecord(this, 'AppAliasRecord', {
      zone: props.certificateStack.hostedZone,
      recordName: props.certificateStack.subDomainName,  // サブドメインを指定（app.example.com）
      target: route53.RecordTarget.fromAlias(new route53targets.LoadBalancerTarget(props.alb)),
    });

    // test-app.example.com のレコード作成
    new route53.ARecord(this, 'TestAppAliasRecord', {
      zone: props.certificateStack.hostedZone,
      recordName: props.certificateStack.testSubDomainName,  // サブドメインを指定（test-app.example.com）
      target: route53.RecordTarget.fromAlias(new route53targets.LoadBalancerTarget(props.alb)),
    });
  }
}
