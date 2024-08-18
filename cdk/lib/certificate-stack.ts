import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';

interface CertificateStackProps extends StackProps {
  domainName: string;
  subDomainName: string;
}

export class CertificateStack extends Stack {
  
  public readonly hostedZone: route53.IHostedZone;
  public readonly certificate: acm.Certificate;
  public readonly fqdn: string;
  
  constructor(scope: Construct, id: string, props: CertificateStackProps) {
    super(scope, id, props);
    
    this.fqdn = `${props.subDomainName}.${props.domainName}`;
    this.hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: props.domainName,
    });
    
    this.certificate = new acm.Certificate(this, 'AppCertificate', {
      domainName: this.fqdn,
      validation: acm.CertificateValidation.fromDns(this.hostedZone),
    });
  }
}
