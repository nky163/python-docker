import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';

interface CertificateStackProps extends StackProps {
  domainName: string;
  subDomainName: string;
}

export class CertificateStack extends Stack {
  public readonly certificate: acm.Certificate;
  public readonly fqdn: string;
  public readonly subDomainName: string;
  public readonly hostedZone: route53.IHostedZone;

  constructor(scope: Construct, id: string, props: CertificateStackProps) {
    super(scope, id, props);
    
    this.subDomainName = props.subDomainName;
    this.fqdn = `${this.subDomainName}.${props.domainName}`;
    this.hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: props.domainName,
    });
    
    this.certificate = new acm.Certificate(this, 'SiteCertificate', {
      domainName: this.fqdn,
      validation: acm.CertificateValidation.fromDns(this.hostedZone),
    });
  }
}
